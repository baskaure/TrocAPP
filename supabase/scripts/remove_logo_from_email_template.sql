-- Retirer le logo du template d'email review_reminder

UPDATE email_templates
SET 
  html_body = REPLACE(
    html_body,
    '<table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px;"><tr><td style="text-align:center; padding-bottom:24px;"><img src="https://bontroc.fr/logo/mail.png" alt="BonTroc" style="height:40px; width:auto;" /></td></tr>',
    '<table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px;">'
  ),
  updated_at = now()
WHERE name = 'review_reminder'
AND html_body LIKE '%<img src="https://bontroc.fr/logo/mail.png"%';

-- Vérifier le résultat
SELECT name, 
       CASE 
         WHEN html_body NOT LIKE '%<img src="https://bontroc.fr/logo/mail.png"%' THEN '✓ Logo retiré'
         ELSE '✗ Logo toujours présent'
       END as logo_check
FROM email_templates
WHERE name = 'review_reminder';
