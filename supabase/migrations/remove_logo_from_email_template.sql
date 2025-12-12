-- Script pour retirer le logo du template d'email review_reminder
-- Si le logo a été ajouté précédemment, ce script le retire

UPDATE email_templates
SET 
  html_body = REGEXP_REPLACE(
    html_body,
    '<tr><td[^>]*style="[^"]*text-align:center[^"]*padding-bottom:24px[^"]*"[^>]*><img[^>]*src="https://bontroc\.fr/logo/mail\.png"[^>]*></td></tr>',
    '',
    'gi'
  ),
  updated_at = now()
WHERE name = 'review_reminder'
AND html_body LIKE '%<img%src="https://bontroc.fr/logo/mail.png"%';

-- Vérifier le résultat
SELECT name, 
       CASE 
         WHEN html_body NOT LIKE '%<img%src="https://bontroc.fr/logo/mail.png"%' THEN '✓ Logo retiré'
         ELSE '✗ Logo toujours présent'
       END as logo_check
FROM email_templates
WHERE name = 'review_reminder';

