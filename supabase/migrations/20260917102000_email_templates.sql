/*
  # Modèles d'e-mails transactionnels — BonTroc (17/09/2026)

  Source unique des templates (remplace les imports CSV manuels de data/).
  Liens profonds en français (/propositions/<id>, /echanges, /profil, /annonces),
  couleur de marque, pied de page « gérer mes notifications », texte brut avec de vrais retours à la ligne.
  Idempotent : INSERT … ON CONFLICT (name) DO UPDATE.
*/

INSERT INTO public.email_templates (name, subject, html_body, text_body, variables, event_type, is_active)
VALUES (
  'review_reminder',
  $tpl$Rappel - Laissez un avis sur votre échange$tpl$,
  $tpl$<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Rappel avis</title>
  </head>
  <body style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color:#f5f7fb; margin:0; padding:24px;">
    <table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px;">
      <tr>
        <td>
          <p style="color:#475467; font-size:14px;">Bonjour {{recipient_name}},</p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            Merci d'avoir finalisé un échange sur BonTroc concernant <strong>{{listing_title}}</strong>.<br />
            Votre avis aide la communauté à identifier les membres fiables et à fluidifier les prochains échanges.
          </p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            Il vous suffit de quelques secondes pour partager votre expérience.
          </p>
          <p style="margin:32px 0;">
            <a href="https://bontroc.fr/echanges" style="display:inline-block; padding:14px 28px; background-color:#2D8DBF; color:#ffffff; font-weight:600; border-radius:999px; text-decoration:none;">Laisser un avis maintenant</a>
          </p>
          <p style="color:#475467; font-size:14px;">
            Merci pour votre contribution à une communauté de troc fiable et bienveillante.<br />
            — L'équipe BonTroc
          </p>
        <p style="color:#98a2b3; font-size:12px; line-height:18px; margin-top:24px;">Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. <a href="https://bontroc.fr/parametres" style="color:#2D8DBF;">Gérer mes notifications</a> · <a href="https://bontroc.fr/confidentialite" style="color:#2D8DBF;">Confidentialité</a></p>
        </td>
      </tr>
    </table>
  </body>
</html>$tpl$,
  $tpl$Bonjour {{recipient_name}},

Merci d'avoir finalisé un échange sur BonTroc pour {{listing_title}}. Pouvez-vous prendre 30 secondes pour laisser un avis ?

Votre retour aide la communauté à identifier les membres fiables pour leurs prochains échanges.

👉 https://bontroc.fr/echanges

Merci !
— L'équipe BonTroc

Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. Gérer mes notifications : https://bontroc.fr/parametres$tpl$,
  '["listing_title", "recipient_name"]'::jsonb,
  'review_reminder',
  true
)
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, event_type = EXCLUDED.event_type, is_active = EXCLUDED.is_active, updated_at = now();

INSERT INTO public.email_templates (name, subject, html_body, text_body, variables, event_type, is_active)
VALUES (
  'new_proposal',
  $tpl$Nouvelle proposition reçue pour votre annonce$tpl$,
  $tpl$<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nouvelle proposition</title>
  </head>
  <body style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color:#f5f7fb; margin:0; padding:24px;">
    <table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px;">
      <tr>
        <td>
          <p style="color:#475467; font-size:14px;">Bonjour,</p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            <strong>{{proposer_name}}</strong> vous a envoyé une proposition pour votre annonce <strong>{{listing_title}}</strong>.
          </p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            Connectez-vous pour voir les détails et répondre à cette proposition.
          </p>
          <p style="margin:32px 0;">
            <a href="https://bontroc.fr/propositions/{{proposal_id}}" style="display:inline-block; padding:14px 28px; background-color:#2D8DBF; color:#ffffff; font-weight:600; border-radius:999px; text-decoration:none;">Voir la proposition</a>
          </p>
          <p style="color:#475467; font-size:14px;">
            À bientôt sur BonTroc !<br />
            — L'équipe BonTroc
          </p>
        <p style="color:#98a2b3; font-size:12px; line-height:18px; margin-top:24px;">Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. <a href="https://bontroc.fr/parametres" style="color:#2D8DBF;">Gérer mes notifications</a> · <a href="https://bontroc.fr/confidentialite" style="color:#2D8DBF;">Confidentialité</a></p>
        </td>
      </tr>
    </table>
  </body>
</html>$tpl$,
  $tpl$Bonjour,

{{proposer_name}} vous a envoyé une proposition pour votre annonce {{listing_title}}.

Connectez-vous pour voir les détails et répondre.

👉 https://bontroc.fr/propositions/{{proposal_id}}

À bientôt !
— L'équipe BonTroc

Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. Gérer mes notifications : https://bontroc.fr/parametres$tpl$,
  '["listing_title", "proposal_id", "proposer_name"]'::jsonb,
  'new_proposal',
  true
)
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, event_type = EXCLUDED.event_type, is_active = EXCLUDED.is_active, updated_at = now();

INSERT INTO public.email_templates (name, subject, html_body, text_body, variables, event_type, is_active)
VALUES (
  'exchange_reminder',
  $tpl$Rappel - Finalisez votre échange en cours$tpl$,
  $tpl$<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Rappel échange</title>
  </head>
  <body style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color:#f5f7fb; margin:0; padding:24px;">
    <table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px;">
      <tr>
        <td>
          <p style="color:#475467; font-size:14px;">Bonjour {{recipient_name}},</p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            Vous avez un échange en cours concernant <strong>{{listing_title}}</strong> avec <strong>{{counterpart_name}}</strong> qui nécessite votre attention.
          </p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            N'oubliez pas de finaliser les étapes restantes pour compléter votre échange.
          </p>
          <p style="margin:32px 0;">
            <a href="https://bontroc.fr/echanges" style="display:inline-block; padding:14px 28px; background-color:#2D8DBF; color:#ffffff; font-weight:600; border-radius:999px; text-decoration:none;">Voir mon échange</a>
          </p>
          <p style="color:#475467; font-size:14px;">
            Bon échange !<br />
            — L'équipe BonTroc
          </p>
        <p style="color:#98a2b3; font-size:12px; line-height:18px; margin-top:24px;">Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. <a href="https://bontroc.fr/parametres" style="color:#2D8DBF;">Gérer mes notifications</a> · <a href="https://bontroc.fr/confidentialite" style="color:#2D8DBF;">Confidentialité</a></p>
        </td>
      </tr>
    </table>
  </body>
</html>$tpl$,
  $tpl$Bonjour {{recipient_name}},

Vous avez un échange en cours concernant {{listing_title}} avec {{counterpart_name}} qui nécessite votre attention.

N'oubliez pas de finaliser les étapes restantes pour compléter votre échange.

👉 https://bontroc.fr/echanges

Bon échange !
— L'équipe BonTroc

Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. Gérer mes notifications : https://bontroc.fr/parametres$tpl$,
  '["counterpart_name", "listing_title", "recipient_name"]'::jsonb,
  'exchange_reminder',
  true
)
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, event_type = EXCLUDED.event_type, is_active = EXCLUDED.is_active, updated_at = now();

INSERT INTO public.email_templates (name, subject, html_body, text_body, variables, event_type, is_active)
VALUES (
  'counter_proposal',
  $tpl$Nouvelle contre-proposition reçue$tpl$,
  $tpl$<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Contre-proposition</title>
  </head>
  <body style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color:#f5f7fb; margin:0; padding:24px;">
    <table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px;">
      <tr>
        <td>
          <p style="color:#475467; font-size:14px;">Bonjour,</p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            <strong>{{counter_proposer_name}}</strong> vous a fait une contre-proposition pour votre annonce <strong>{{listing_title}}</strong>.
          </p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            Connectez-vous pour voir les détails de cette nouvelle proposition et y répondre.
          </p>
          <p style="margin:32px 0;">
            <a href="https://bontroc.fr/propositions/{{proposal_id}}" style="display:inline-block; padding:14px 28px; background-color:#2D8DBF; color:#ffffff; font-weight:600; border-radius:999px; text-decoration:none;">Voir la contre-proposition</a>
          </p>
          <p style="color:#475467; font-size:14px;">
            À bientôt sur BonTroc !<br />
            — L'équipe BonTroc
          </p>
        <p style="color:#98a2b3; font-size:12px; line-height:18px; margin-top:24px;">Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. <a href="https://bontroc.fr/parametres" style="color:#2D8DBF;">Gérer mes notifications</a> · <a href="https://bontroc.fr/confidentialite" style="color:#2D8DBF;">Confidentialité</a></p>
        </td>
      </tr>
    </table>
  </body>
</html>$tpl$,
  $tpl$Bonjour,

{{counter_proposer_name}} vous a fait une contre-proposition pour votre annonce {{listing_title}}.

Connectez-vous pour voir les détails de cette nouvelle proposition et y répondre.

👉 https://bontroc.fr/propositions/{{proposal_id}}

À bientôt !
— L'équipe BonTroc

Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. Gérer mes notifications : https://bontroc.fr/parametres$tpl$,
  '["counter_proposer_name", "listing_title", "proposal_id"]'::jsonb,
  'counter_proposal',
  true
)
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, event_type = EXCLUDED.event_type, is_active = EXCLUDED.is_active, updated_at = now();

INSERT INTO public.email_templates (name, subject, html_body, text_body, variables, event_type, is_active)
VALUES (
  'new_chat_message',
  $tpl$Nouveau message dans votre conversation$tpl$,
  $tpl$<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nouveau message</title>
  </head>
  <body style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color:#f5f7fb; margin:0; padding:24px;">
    <table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px;">
      <tr>
        <td>
          <p style="color:#475467; font-size:14px;">Bonjour {{recipient_name}},</p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            <strong>{{sender_name}}</strong> vous a envoyé un nouveau message concernant votre proposition.
          </p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            Connectez-vous pour lire le message et répondre.
          </p>
          <p style="margin:32px 0;">
            <a href="https://bontroc.fr/propositions/{{proposal_id}}" style="display:inline-block; padding:14px 28px; background-color:#2D8DBF; color:#ffffff; font-weight:600; border-radius:999px; text-decoration:none;">Voir le message</a>
          </p>
          <p style="color:#475467; font-size:14px;">
            À bientôt sur BonTroc !<br />
            — L'équipe BonTroc
          </p>
        <p style="color:#98a2b3; font-size:12px; line-height:18px; margin-top:24px;">Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. <a href="https://bontroc.fr/parametres" style="color:#2D8DBF;">Gérer mes notifications</a> · <a href="https://bontroc.fr/confidentialite" style="color:#2D8DBF;">Confidentialité</a></p>
        </td>
      </tr>
    </table>
  </body>
</html>$tpl$,
  $tpl$Bonjour {{recipient_name}},

{{sender_name}} vous a envoyé un nouveau message concernant votre proposition.

Connectez-vous pour lire le message et répondre.

👉 https://bontroc.fr/propositions/{{proposal_id}}

À bientôt !
— L'équipe BonTroc

Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. Gérer mes notifications : https://bontroc.fr/parametres$tpl$,
  '["proposal_id", "recipient_name", "sender_name"]'::jsonb,
  'new_chat_message',
  true
)
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, event_type = EXCLUDED.event_type, is_active = EXCLUDED.is_active, updated_at = now();

INSERT INTO public.email_templates (name, subject, html_body, text_body, variables, event_type, is_active)
VALUES (
  'contract_ready',
  $tpl$Votre contrat est prêt à être signé$tpl$,
  $tpl$<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Contrat prêt</title>
  </head>
  <body style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color:#f5f7fb; margin:0; padding:24px;">
    <table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px;">
      <tr>
        <td>
          <p style="color:#475467; font-size:14px;">Bonjour,</p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            Votre contrat pour l'échange <strong>{{listing_title}}</strong> avec <strong>{{counterpart_name}}</strong> est maintenant prêt.
          </p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            Vous pouvez le consulter, le signer et suivre l'avancement de votre échange.
          </p>
          <p style="margin:32px 0;">
            <a href="https://bontroc.fr/echanges" style="display:inline-block; padding:14px 28px; background-color:#2D8DBF; color:#ffffff; font-weight:600; border-radius:999px; text-decoration:none;">Voir le contrat</a>
          </p>
          <p style="color:#475467; font-size:14px;">
            Bon échange !<br />
            — L'équipe BonTroc
          </p>
        <p style="color:#98a2b3; font-size:12px; line-height:18px; margin-top:24px;">Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. <a href="https://bontroc.fr/parametres" style="color:#2D8DBF;">Gérer mes notifications</a> · <a href="https://bontroc.fr/confidentialite" style="color:#2D8DBF;">Confidentialité</a></p>
        </td>
      </tr>
    </table>
  </body>
</html>$tpl$,
  $tpl$Bonjour,

Votre contrat pour l'échange {{listing_title}} avec {{counterpart_name}} est maintenant prêt.

Vous pouvez le consulter, le signer et suivre l'avancement de votre échange.

👉 https://bontroc.fr/echanges

Bon échange !
— L'équipe BonTroc

Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. Gérer mes notifications : https://bontroc.fr/parametres$tpl$,
  '["counterpart_name", "listing_title"]'::jsonb,
  'contract_ready',
  true
)
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, event_type = EXCLUDED.event_type, is_active = EXCLUDED.is_active, updated_at = now();

INSERT INTO public.email_templates (name, subject, html_body, text_body, variables, event_type, is_active)
VALUES (
  'welcome',
  $tpl$Bienvenue sur BonTroc !$tpl$,
  $tpl$<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bienvenue</title>
  </head>
  <body style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color:#f5f7fb; margin:0; padding:24px;">
    <table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px;">
      <tr>
        <td>
          <p style="color:#475467; font-size:14px;">Bonjour {{display_name}},</p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            Bienvenue sur <strong>BonTroc</strong> ! Nous sommes ravis de vous compter parmi nous.
          </p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            BonTroc est la plateforme où vous pouvez échanger vos services et produits sans argent. Créez votre première annonce ou explorez celles déjà disponibles.
          </p>
          <p style="margin:32px 0;">
            <a href="https://bontroc.fr/annonces" style="display:inline-block; padding:14px 28px; background-color:#2D8DBF; color:#ffffff; font-weight:600; border-radius:999px; text-decoration:none;">Commencer à explorer</a>
          </p>
          <p style="color:#475467; font-size:14px;">
            Si vous avez des questions, n'hésitez pas à nous contacter.<br />
            — L'équipe BonTroc
          </p>
        <p style="color:#98a2b3; font-size:12px; line-height:18px; margin-top:24px;">Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. <a href="https://bontroc.fr/parametres" style="color:#2D8DBF;">Gérer mes notifications</a> · <a href="https://bontroc.fr/confidentialite" style="color:#2D8DBF;">Confidentialité</a></p>
        </td>
      </tr>
    </table>
  </body>
</html>$tpl$,
  $tpl$Bonjour {{display_name}},

Bienvenue sur BonTroc ! Nous sommes ravis de vous compter parmi nous.

BonTroc est la plateforme où vous pouvez échanger vos services et produits sans argent. Créez votre première annonce ou explorez celles déjà disponibles.

👉 https://bontroc.fr/annonces

Si vous avez des questions, n'hésitez pas à nous contacter.
— L'équipe BonTroc

Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. Gérer mes notifications : https://bontroc.fr/parametres$tpl$,
  '["display_name"]'::jsonb,
  'welcome',
  true
)
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, event_type = EXCLUDED.event_type, is_active = EXCLUDED.is_active, updated_at = now();

INSERT INTO public.email_templates (name, subject, html_body, text_body, variables, event_type, is_active)
VALUES (
  'new_review',
  $tpl$Vous avez reçu un nouvel avis$tpl$,
  $tpl$<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nouvel avis</title>
  </head>
  <body style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color:#f5f7fb; margin:0; padding:24px;">
    <table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px;">
      <tr>
        <td>
          <p style="color:#475467; font-size:14px;">Bonjour,</p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            <strong>{{reviewer_name}}</strong> vous a laissé un avis avec une note de <strong>{{rating}}/5</strong> suite à votre échange.
          </p>
          <p style="color:#101828; font-size:16px; line-height:24px;">
            Les avis aident à renforcer la confiance au sein de la communauté BonTroc. Consultez votre profil pour voir tous vos avis.
          </p>
          <p style="margin:32px 0;">
            <a href="https://bontroc.fr/profil" style="display:inline-block; padding:14px 28px; background-color:#2D8DBF; color:#ffffff; font-weight:600; border-radius:999px; text-decoration:none;">Voir mon profil</a>
          </p>
          <p style="color:#475467; font-size:14px;">
            Merci pour votre participation à la communauté !<br />
            — L'équipe BonTroc
          </p>
        <p style="color:#98a2b3; font-size:12px; line-height:18px; margin-top:24px;">Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. <a href="https://bontroc.fr/parametres" style="color:#2D8DBF;">Gérer mes notifications</a> · <a href="https://bontroc.fr/confidentialite" style="color:#2D8DBF;">Confidentialité</a></p>
        </td>
      </tr>
    </table>
  </body>
</html>$tpl$,
  $tpl$Bonjour,

{{reviewer_name}} vous a laissé un avis avec une note de {{rating}}/5 suite à votre échange.

Les avis aident à renforcer la confiance au sein de la communauté BonTroc. Consultez votre profil pour voir tous vos avis.

👉 https://bontroc.fr/profil

Merci pour votre participation !
— L'équipe BonTroc

Vous recevez cet e-mail parce que vous avez un compte sur BonTroc. Gérer mes notifications : https://bontroc.fr/parametres$tpl$,
  '["rating", "reviewer_name"]'::jsonb,
  'new_review',
  true
)
ON CONFLICT (name) DO UPDATE SET subject = EXCLUDED.subject, html_body = EXCLUDED.html_body, text_body = EXCLUDED.text_body, variables = EXCLUDED.variables, event_type = EXCLUDED.event_type, is_active = EXCLUDED.is_active, updated_at = now();
