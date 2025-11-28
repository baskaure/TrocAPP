# 🔐 Secrets DocuSign pour Supabase

## Liste complète des secrets à configurer

Va dans **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets** et ajoute/modifie ces secrets :

### 1. DOCUSIGN_CLIENT_ID
```
3ee8483e-e2af-4bab-8e8a-0d9134c7344a
```
*(Ton Integration Key)*

### 2. DOCUSIGN_RSA_PRIVATE_KEY
```
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAxFSvWPeSewXpFEJj+H8gnFBppufLLjcTYFpT0VLH8HHttyYt
S5QajppesJalzDrAGBSwKi3iYr1x9STsOa4Im7Wu5QxPwhQCNfzKQK5NO+nF5P9P
QeoWKoLz1+VcZRLxLTaJfZ8LaRg5Mn+TLBVvaG37/47jOkrt1tYuDPVu391IOLfq
bBup3MdKVZGh1eICut35LPL6yIgVZOluaHv1hUUrwOyI3jdE8hjQwyrErh+ttQrs
wzGwxHmy1mjrPsUa+owXzxFeE7BaUXDIe0fi29BnKJExoCbOMm5UvXuUMr+HJuWJ
Ls4BVjv4ENywyA7fLiKSyEGng1q3cNn046cD/wIDAQABAoIBAB3LYueT0qqmz/i0
xpUckydbBgg/9FP+zwr39PEMU1ldq3Si74whCBK3bJf3P2a0om2ac3hDNFrwYw3l
MjripV3JVFG1l5kIDk8ryMnIvzcmF/5+RwSQG223fSfjdS0a6HeIZ5R6gXHL15+e
lV1togBCyKkU1yOui/+RdgrzaDBtZpIIhgfcjrUQJDPd0Lw1BLYSEqqNudrcYIvT
mzA/jNh/+KHNkxujo1e3rVKWrmuGUm7+pg7fd0T6m8KPc5n10jLU2C6ndUSBRKM7
kPNdm/5hdnMNsakpqWqE60q4yhz6P8Zm7wPffhYirViym/KPy7xlXHNNUP87GOEM
3vZbLYECgYEA7/+qyry6+lB9s3uqopyIhi7lUoGwewvdpsSrYDbYBH2SUUFJRA3I
S9I6uoOl3g2ttCZhe8VL2OeOHju+9PT3ZWiwv82NffBCRP/XV/Vk+D9+gJYN4Vl4
Un4E5IuXjiVa6twLJs0MK5yml0VNP/Gfo4EZz0n15KaSA0Xke4Ij1r8CgYEA0Wuw
Di4+K83VZrwPkIz3r41iS0+J36eAagn8g0eYOjuhFL6/HyJV7cFm2azno4SD+gVh
a37rEJLV43VIwXE+SF+CMGwfKFKN8g82Bwr21HC2pGqLORr3jWaIFzixSTsSaZFw
cguVkDhBYpiLiZYeAfQiQAOmy5vFcvtsfrHTYsECgYEAkTfLOUc/gAzKMpsmoaRD
u6WOnwDYL2v7n1grNlmZFgaBTWdKlMIeKzq2zHqyF42BSJtcqw6zmThrNwIBxqif
NZ5GLJiM/+IrxyJjQ9a5VLjeq6GgHnYLpyaXgU6x0pHp1Gh22vCBZ7Yu2yNU3dcv
ODj6zAG9pq/fc9mLqewSEXMCgYBTLYB5wWg0Icb2zQ8pjLP76B34Z5kNWgwpEdpX
kiImTvTFtpVWml6i1kQxhPlj+wgoT+bHuVtH8+o8M6M4IfBo8nZVITym2VNDp0MA
PRyYeEQyvZaakdltMiIvhvbzbSD9CSUuRueapp1hudECTruQbxUDc+/VwwMDjlUj
ZSHegQKBgFoNplebUkZnwJiwfP8ehED+fBdQPH/TuxZhlG0Qd7gDsGHtZddS0bdU
dYxX+0eK7F5leTZi5uRPy8FU8idv788OxpYJ+I+l4IczZohQc0NFzfXThW5JuyIs
g7FRhVnDuQl+OniFAqHNEBzvjztgMG3y775pagOxHIxY27LFBH/W
-----END RSA PRIVATE KEY-----
```
*(Ta clé privée RSA - IMPORTANT : Copie-la exactement comme ci-dessus, avec les retours à la ligne)*

**⚠️ Format dans Supabase :**
- Soit sur une seule ligne avec `\n` : `-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAxFSvWPeSewXpFEJj+H8gnFBppufLLjcTYFpT0VLH8HHttyYt\n...\n-----END RSA PRIVATE KEY-----`
- Soit en format multiligne si Supabase le supporte

### 3. DOCUSIGN_USER_ID
```
kurashi.uchiwa@gmail.com
```
*(Ton email DocuSign)*

### 4. DOCUSIGN_ACCOUNT_ID
```
5ce0337f-5a07-41d6-9bb9-2581c48badba
```
*(Ton API Account ID)*

### 5. DOCUSIGN_BASE_URL
```
https://demo.docusign.net
```
*(Pour l'environnement demo/sandbox - Change en `https://www.docusign.net` pour la production)*

### 6. DOCUSIGN_WEBHOOK_SECRET (Optionnel pour l'instant)
```
[À REMPLIR PLUS TARD]
```
*(Une clé secrète pour valider les webhooks DocuSign - on peut l'ajouter plus tard)*

---

## 📋 Checklist de configuration

- [ ] `DOCUSIGN_CLIENT_ID` = `3ee8483e-e2af-4bab-8e8a-0d9134c7344a`
- [ ] `DOCUSIGN_RSA_PRIVATE_KEY` = Clé privée RSA (vérifie qu'elle correspond à la clé publique dans DocuSign)
- [ ] `DOCUSIGN_USER_ID` = `kurashi.uchiwa@gmail.com`
- [ ] `DOCUSIGN_ACCOUNT_ID` = `5ce0337f-5a07-41d6-9bb9-2581c48badba`
- [ ] `DOCUSIGN_BASE_URL` = `https://demo.docusign.net`
- [x] Clé publique correspondante uploadée dans DocuSign (déjà fait ✅)

## ✅ Informations DocuSign configurées

- **User ID** : `ed4ace68-05c4-4994-b859-0e0f5cd4729a`
- **API Account ID** : `5ce0337f-5a07-41d6-9bb9-2581c48badba`
- **Account Base URI** : `https://demo.docusign.net`

## ✅ Après configuration

Une fois tous les secrets configurés :
1. Redéploie la fonction Edge Function (ou attends quelques minutes)
2. Teste en cliquant sur "Traiter les demandes" dans l'admin panel
3. Vérifie les logs dans Supabase Dashboard → Edge Functions → `process-esign-requests` → Logs

