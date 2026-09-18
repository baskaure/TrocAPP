import type { LegalSection } from '../../lib/router';
import { PageBackLink } from '../layout/PageBackLink';

type LegalPageProps = {
  section: LegalSection;
  onBack: () => void;
  onNavigate: (section: LegalSection) => void;
};

/*
  Éditeur : KINGDOM ADS (SAS, RCS Montpellier 914 723 044), données issues du registre.
  Restent deux champs marqués [À COMPLÉTER] : le numéro de téléphone, exigé par l'article
  6 III-1 de la LCEN, et le médiateur de la consommation, obligatoire pour une plateforme
  ouverte aux particuliers (article L. 612-1 du code de la consommation).
  Les mentions d'hébergement correspondent à l'infrastructure réelle : Netlify pour le
  site, Supabase en Irlande pour les données, Resend pour les e-mails.
*/
const LAST_UPDATE = '18 septembre 2026';

const TABS: { section: LegalSection; label: string }[] = [
  { section: 'mentions-legales', label: 'Mentions légales' },
  { section: 'confidentialite', label: 'Confidentialité' },
  { section: 'cgu', label: 'Conditions d’utilisation' },
];

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 mt-10 font-headline text-xl font-bold tracking-tight text-on-surface first:mt-0 sm:text-2xl">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-base leading-relaxed text-on-surface-variant">{children}</p>;
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-secondary-container/50 px-1 font-semibold text-on-secondary-container">[À COMPLÉTER : {children}]</span>;
}

function MentionsLegales() {
  return (
    <>
      <H2>Éditeur du site</H2>
      <P>
        Le site bontroc.fr est édité par <strong className="text-on-surface">KINGDOM ADS</strong>, société par actions
        simplifiée au capital de 1 000 €, dont le siège social est situé 199 rue Hélène Boucher, 34170
        Castelnau-le-Lez, France.
      </P>
      <ul className="mb-4 list-disc space-y-1 pl-6 text-base leading-relaxed text-on-surface-variant">
        <li>SIREN : 914 723 044</li>
        <li>SIRET (siège) : 914 723 044 00014</li>
        <li>RCS : 914 723 044 R.C.S. Montpellier, immatriculée le 21 juin 2022</li>
        <li>Numéro de TVA intracommunautaire : FR53914723044</li>
        <li>Code APE : 73.11Z — activités des agences de publicité</li>
      </ul>
      <P>
        Directeur de la publication : William Adamsha, président. Contact :{' '}
        <a href="mailto:contact@bontroc.fr" className="font-semibold text-primary hover:underline">
          contact@bontroc.fr
        </a>
        , téléphone <Placeholder>numéro de téléphone</Placeholder>.
      </P>

      <H2>Hébergement</H2>
      <P>
        Le site est hébergé par Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis. Les données de
        la plateforme (comptes, annonces, messages, contrats) sont stockées par Supabase, Inc. sur des serveurs situés en Irlande
        (région AWS eu-west-1). Les e-mails sont envoyés via Resend, Inc.
      </P>

      <H2>Propriété intellectuelle</H2>
      <P>
        La marque BonTroc, le logo, la charte graphique et le code de la plateforme appartiennent à KINGDOM ADS. Les contenus
        publiés par les membres (textes, photos) restent leur propriété ; en les publiant, ils autorisent BonTroc à les afficher
        sur le site le temps de la publication.
      </P>

      <H2>Cartes</H2>
      <P>
        Les fonds de carte proviennent d’OpenStreetMap (données © contributeurs OpenStreetMap, licence ODbL) et de CARTO. La
        géolocalisation des villes s’appuie sur Nominatim (OpenStreetMap) et Photon (Komoot).
      </P>
    </>
  );
}

function Confidentialite() {
  return (
    <>
      <P>
        Cette page explique quelles données BonTroc collecte, pourquoi, combien de temps elles sont gardées et comment exercer
        vos droits. Le responsable du traitement est KINGDOM ADS, 199 rue Hélène Boucher, 34170 Castelnau-le-Lez, joignable à{' '}
        <a href="mailto:contact@bontroc.fr" className="font-semibold text-primary hover:underline">
          contact@bontroc.fr
        </a>
        .
      </P>

      <H2>Ce que nous collectons</H2>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-on-surface-variant">
        <li>
          <strong className="text-on-surface">Compte</strong> : adresse e-mail, nom affiché, nom d’utilisateur, mot de passe (stocké
          sous forme hachée, jamais en clair). Avec Google, nous recevons votre nom, votre e-mail et votre photo de profil.
        </li>
        <li>
          <strong className="text-on-surface">Profil</strong> : ville, pays, biographie, langues, compétences, photos, numéro de
          téléphone si vous choisissez de le renseigner. Seuls le nom affiché, le pseudo, la ville, la photo, la biographie et la
          note sont visibles des autres membres. L’e-mail et le téléphone ne sont jamais montrés.
        </li>
        <li>
          <strong className="text-on-surface">Activité</strong> : annonces, propositions, messages, contrats d’échange, avis,
          signalements, litiges.
        </li>
        <li>
          <strong className="text-on-surface">Vérification d’identité (facultative)</strong> : la pièce d’identité que vous envoyez
          est stockée dans un espace privé, consultée uniquement par l’équipe de modération, puis supprimée dès la décision prise.
        </li>
        <li>
          <strong className="text-on-surface">Données techniques</strong> : journaux de connexion et d’envoi d’e-mails, adresse IP
          traitée par nos hébergeurs pour la sécurité du service.
        </li>
      </ul>

      <H2>Pourquoi</H2>
      <P>
        Faire fonctionner le service que vous avez demandé en créant un compte (exécution du contrat) : publier, échanger,
        signer un contrat, laisser un avis. Assurer la sécurité et la modération de la plateforme, et répondre à nos
        obligations légales (intérêt légitime et obligation légale). La vérification d’identité repose sur votre consentement,
        que vous pouvez ne pas donner.
      </P>

      <H2>Qui y accède</H2>
      <P>
        Nos prestataires techniques, chacun pour sa mission : Supabase (base de données et authentification, Irlande), Netlify
        (hébergement du site, États-Unis, encadré par les clauses contractuelles types de la Commission européenne), Resend
        (envoi d’e-mails), Google (connexion avec un compte Google, si vous l’utilisez). Quand une carte s’affiche, votre
        navigateur contacte les serveurs de CARTO, OpenStreetMap ou Photon, qui voient alors votre adresse IP. Nous ne vendons
        aucune donnée et n’utilisons aucun traceur publicitaire.
      </P>

      <H2>Combien de temps</H2>
      <P>
        Tant que votre compte est actif. Si vous le supprimez, votre profil est anonymisé, vos annonces retirées et vos photos
        effacées ; les contrats et avis liés aux échanges déjà réalisés sont conservés sans donnée personnelle, car ils
        concernent aussi l’autre partie. Les documents d’identité sont supprimés après examen. Les journaux d’e-mails sont gardés
        douze mois.
      </P>

      <H2>Cookies</H2>
      <P>
        BonTroc n’utilise que le stockage local de votre navigateur pour maintenir votre session ouverte. Aucun cookie
        publicitaire ni outil de mesure d’audience n’est déposé, il n’y a donc pas de bandeau à accepter.
      </P>

      <H2>Vos droits</H2>
      <P>
        Vous pouvez consulter, corriger, exporter (bouton « Télécharger mes données » dans les paramètres) ou supprimer vos
        données à tout moment depuis votre compte. Pour toute autre demande, écrivez à{' '}
        <a href="mailto:contact@bontroc.fr" className="font-semibold text-primary hover:underline">
          contact@bontroc.fr
        </a>
        . Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (cnil.fr).
      </P>
    </>
  );
}

function Cgu() {
  return (
    <>
      <H2>Ce qu’est BonTroc</H2>
      <P>
        BonTroc met en relation des personnes et des professionnels qui souhaitent échanger des services ou des biens sans
        paiement en argent. La plateforme fournit les outils (annonces, messagerie, contrat d’échange, suivi, avis) ; elle
        n’est pas partie aux échanges conclus entre membres et ne garantit ni la qualité, ni la valeur, ni la bonne exécution de
        ce qui est échangé.
      </P>

      <H2>Inscription</H2>
      <P>
        L’inscription est gratuite et réservée aux personnes majeures. Vous fournissez des informations exactes, gardez votre mot
        de passe confidentiel et êtes responsable de ce qui est fait depuis votre compte. Un seul compte par personne.
      </P>

      <H2>Vos publications</H2>
      <P>
        Vous ne publiez que des annonces licites, décrites honnêtement, portant sur des biens dont vous disposez ou des services
        que vous pouvez rendre. Sont interdits notamment : les biens contrefaits, dangereux ou réglementés, les contenus
        trompeurs, injurieux ou discriminatoires, la collecte d’informations personnelles d’autres membres et toute
        sollicitation commerciale hors du cadre de l’échange. Un filtre automatique et l’équipe de modération peuvent
        refuser, suspendre ou retirer un contenu.
      </P>

      <H2>Déroulement d’un échange</H2>
      <P>
        Une proposition acceptée génère un contrat d’échange reprenant l’annonce et la contrepartie. Chaque partie le signe par
        un clic, ce qui vaut signature électronique simple au sens du règlement eIDAS. L’échange démarre après les deux
        signatures ; chacun marque sa part comme livrée, l’autre confirme. Les modalités concrètes (date, lieu, état,
        quantité) sont convenues entre vous dans la messagerie et font partie de votre accord.
      </P>

      <H2>Litiges entre membres</H2>
      <P>
        En cas de désaccord, ouvrez un litige depuis le suivi de l’échange. L’équipe BonTroc peut proposer une médiation, mais ne
        rend pas de décision qui s’imposerait aux parties : chacun conserve ses recours de droit commun.
      </P>
      <P>
        Si vous êtes consommateur et que notre réponse ne vous satisfait pas, vous pouvez saisir gratuitement un médiateur de la
        consommation : <Placeholder>nom et coordonnées du médiateur auquel KINGDOM ADS adhère</Placeholder>. La plateforme
        européenne de règlement en ligne des litiges reste accessible à l’adresse{' '}
        <a href="https://ec.europa.eu/consumers/odr" className="font-semibold text-primary hover:underline" rel="noopener noreferrer" target="_blank">
          ec.europa.eu/consumers/odr
        </a>
        .
      </P>

      <H2>Obligations fiscales et légales</H2>
      <P>
        Un échange de biens ou de services peut avoir des conséquences fiscales ou sociales, en particulier pour les
        professionnels (l’administration considère le troc comme une vente suivie d’un achat). Chaque membre en reste seul
        responsable.
      </P>

      <H2>Suspension et suppression</H2>
      <P>
        BonTroc peut suspendre un compte qui enfreint ces conditions, après avertissement sauf urgence. Vous pouvez supprimer
        votre compte à tout moment depuis les paramètres ; les échanges en cours sont alors annulés.
      </P>

      <H2>Responsabilité</H2>
      <P>
        BonTroc fournit le service en l’état et fait le nécessaire pour qu’il reste disponible et sûr, sans garantie d’absence
        d’interruption. La plateforme ne répond pas des dommages résultant d’un échange entre membres ou d’un usage non
        conforme du service.
      </P>

      <H2>Droit applicable</H2>
      <P>
        Ces conditions sont soumises au droit français. À défaut d’accord amiable, les tribunaux français sont compétents. Pour
        un membre consommateur, la juridiction de son lieu de résidence reste compétente.
      </P>
    </>
  );
}

export function LegalPage({ section, onBack, onNavigate }: LegalPageProps) {
  const title =
    section === 'cgu'
      ? 'Conditions générales d’utilisation'
      : section === 'confidentialite'
        ? 'Politique de confidentialité'
        : 'Mentions légales';

  return (
    <div className="w-full max-w-3xl">
      <PageBackLink onClick={onBack} label="Retour" />
      <header className="mb-8">
        <h1 className="mb-3 font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">{title}</h1>
        <p className="text-sm text-on-surface-variant">Dernière mise à jour : {LAST_UPDATE}</p>
      </header>

      <nav aria-label="Pages légales" className="mb-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.section}
            type="button"
            onClick={() => onNavigate(t.section)}
            aria-current={t.section === section ? 'page' : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
              t.section === section
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <article className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-soft-lg sm:p-10">
        {section === 'mentions-legales' ? <MentionsLegales /> : section === 'confidentialite' ? <Confidentialite /> : <Cgu />}
      </article>
    </div>
  );
}
