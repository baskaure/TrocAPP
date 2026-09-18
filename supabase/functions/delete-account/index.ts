/**
 * Suppression de compte (RGPD — droit à l'effacement).
 *
 * L'appelant doit être connecté ; il ne peut supprimer que son propre compte.
 * Étapes :
 *  1. profil `public.users` anonymisé et passé en `status = 'deleted'`
 *     (le trigger `handle_user_deactivated` archive les annonces et annule les propositions) ;
 *  2. messages de chat anonymisés, médias de profil supprimés du stockage ;
 *  3. compte `auth.users` : e-mail remplacé par une adresse technique (libère l'adresse
 *     d'origine), mot de passe régénéré, sessions révoquées.
 * Les échanges, contrats et avis sont conservés (obligations légales et intégrité des
 * historiques des autres membres) mais ne portent plus de donnée personnelle.
 */
import { adminClient, getCaller } from '../_shared/auth.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return json(req, { error: 'Méthode non autorisée' }, 405);
  }

  const caller = await getCaller(req);
  if (!caller) {
    return json(req, { error: 'Authentification requise' }, 401);
  }

  const supabase = adminClient();
  const uid = caller.id;
  const anonymisedEmail = `deleted-${uid}@anonymised.bontroc.fr`;

  try {
    // 0. Chemins des médias, lus AVANT l'anonymisation (les colonnes vont être vidées).
    const { data: before } = await supabase.from('users').select('avatar_url, banner_url, verification_document_url').eq('id', uid).maybeSingle();

    // 1. Profil
    const { error: profileError } = await supabase
      .from('users')
      .update({
        status: 'deleted',
        display_name: 'Utilisateur supprimé',
        username: `supprime_${uid.replace(/-/g, '').slice(0, 10)}`,
        email: anonymisedEmail,
        avatar_url: null,
        banner_url: null,
        bio: null,
        phone: null,
        city: null,
        country: null,
        geo_lat: null,
        geo_lng: null,
        languages: [],
        skills: [],
        verification_document_url: null,
        verification_status: 'none',
        verification_notes: null,
        is_verified: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', uid);
    if (profileError) throw new Error(`Profil : ${profileError.message}`);

    // 2. Messages et médias
    await supabase.from('chat_messages').update({ body: '[message supprimé]' }).eq('sender_id', uid);

    // Les avatars et bannières de tous les membres cohabitent dans les mêmes dossiers : on cible
    // les chemins connus, puis on complète par une recherche préfixée (list() est paginé).
    const profilePaths = new Set<string>();
    for (const url of [before?.avatar_url, before?.banner_url]) {
      const marker = '/object/public/profile-media/';
      if (typeof url === 'string' && url.includes(marker)) {
        profilePaths.add(decodeURIComponent(url.split(marker)[1].split('?')[0]));
      }
    }
    for (const prefix of ['avatars', 'banners']) {
      const { data: files } = await supabase.storage.from('profile-media').list(prefix, { limit: 1000, search: uid });
      (files ?? []).filter((f) => f.name.startsWith(uid)).forEach((f) => profilePaths.add(`${prefix}/${f.name}`));
    }
    if (profilePaths.size) await supabase.storage.from('profile-media').remove([...profilePaths]);

    const { data: verifFiles } = await supabase.storage.from('verification-documents').list(uid, { limit: 1000 });
    const verifPaths = (verifFiles ?? []).map((f) => `${uid}/${f.name}`);
    if (typeof before?.verification_document_url === 'string' && before.verification_document_url.startsWith(`${uid}/`)) {
      verifPaths.push(before.verification_document_url);
    }
    if (verifPaths.length) await supabase.storage.from('verification-documents').remove([...new Set(verifPaths)]);

    // 3. Compte d'authentification : adresse libérée, mot de passe inutilisable, et données
    // des identités sociales purgées (l'API d'administration ne le permet pas, d'où la RPC).
    const { error: identityError } = await supabase.rpc('purge_auth_identities', { p_user_id: uid });
    if (identityError) console.warn('purge_auth_identities failed:', identityError.message);

    const { error: authError } = await supabase.auth.admin.updateUserById(uid, {
      email: anonymisedEmail,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: { deleted: true },
      app_metadata: { deleted: true },
    });
    if (authError) {
      // Le profil est déjà anonymisé : on signale l'échec partiel sans laisser croire à une réussite.
      console.error('auth anonymisation failed:', authError.message);
      return json(
        req,
        {
          error:
            'Vos données personnelles ont été effacées, mais la fermeture définitive du compte a échoué. Écrivez à contact@bontroc.fr en citant cet identifiant : ' +
            uid,
        },
        500,
      );
    }

    await supabase.auth.admin.signOut(req.headers.get('Authorization')!.replace(/^Bearer\s+/i, ''), 'global').catch(() => null);

    return json(req, { success: true });
  } catch (error) {
    console.error('delete-account error:', error);
    return json(req, { error: 'La suppression du compte a échoué. Contactez contact@bontroc.fr.' }, 500);
  }
});
