-- Migration pour mettre à jour le domaine de trophub.netlify.app vers bontroc.fr
-- À exécuter dans Supabase SQL Editor après le changement de domaine

-- Mettre à jour le template d'email review_reminder
UPDATE email_templates
SET 
  html_body = REPLACE(REPLACE(html_body, 'https://trophub.netlify.app/exchanges', 'https://bontroc.fr/exchanges'), 'TrocHub', 'BonTroc'),
  text_body = REPLACE(REPLACE(text_body, 'https://trophub.netlify.app/exchanges', 'https://bontroc.fr/exchanges'), 'TrocHub', 'BonTroc'),
  updated_at = now()
WHERE name = 'review_reminder';

-- Vérifier le résultat
SELECT name, 
       subject,
       CASE 
         WHEN html_body LIKE '%bontroc.fr%' THEN '✓ Domaine mis à jour'
         ELSE '✗ Domaine non mis à jour'
       END as domain_check,
       CASE 
         WHEN html_body LIKE '%BonTroc%' THEN '✓ Marque mise à jour'
         ELSE '✗ Marque non mise à jour'
       END as brand_check
FROM email_templates
WHERE name = 'review_reminder';

