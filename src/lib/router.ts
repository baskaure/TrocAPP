/**
 * Routage minimal sans bibliothèque : synchronise l'URL avec la vue active de App.tsx.
 * Permet les liens profonds (e-mails, partage), le bouton « retour » du navigateur et
 * un titre de page par vue. Les chemins sont en français ; quelques alias historiques
 * (ex. /exchanges dans les anciens e-mails) sont acceptés.
 */
export type LegalSection = 'mentions-legales' | 'confidentialite' | 'cgu';

export type Route =
  | { view: 'landing' }
  | { view: 'listings' }
  | { view: 'listing-detail'; id: string }
  | { view: 'create-listing' }
  | { view: 'proposals' }
  | { view: 'proposal-detail'; id: string }
  | { view: 'exchanges' }
  | { view: 'profile' }
  | { view: 'public-profile'; id: string }
  | { view: 'settings' }
  | { view: 'admin' }
  | { view: 'auth'; mode: 'login' | 'register' }
  | { view: 'reset-password' }
  | { view: 'legal'; section: LegalSection };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALIASES: Record<string, string> = {
  '/exchanges': '/echanges',
  '/proposals': '/propositions',
  '/listings': '/annonces',
  '/profile': '/profil',
  '/settings': '/parametres',
  '/login': '/connexion',
  '/register': '/inscription',
  '/signup': '/inscription',
};

export function parsePath(pathname: string): Route {
  let path = pathname.replace(/\/+$/, '') || '/';
  path = ALIASES[path] ?? path;
  const parts = path.split('/').filter(Boolean);
  const [head, second] = parts;

  if (!head) return { view: 'landing' };
  switch (head) {
    case 'annonces':
      if (second === 'nouvelle') return { view: 'create-listing' };
      if (second && UUID_RE.test(second)) return { view: 'listing-detail', id: second };
      return { view: 'listings' };
    case 'publier':
      return { view: 'create-listing' };
    case 'propositions':
      if (second && UUID_RE.test(second)) return { view: 'proposal-detail', id: second };
      return { view: 'proposals' };
    case 'echanges':
      return { view: 'exchanges' };
    case 'profil':
      if (second && UUID_RE.test(second)) return { view: 'public-profile', id: second };
      return { view: 'profile' };
    case 'membres':
      if (second && UUID_RE.test(second)) return { view: 'public-profile', id: second };
      return { view: 'listings' };
    case 'parametres':
      return { view: 'settings' };
    case 'admin':
      return { view: 'admin' };
    case 'connexion':
      return { view: 'auth', mode: 'login' };
    case 'inscription':
      return { view: 'auth', mode: 'register' };
    case 'reinitialiser-mot-de-passe':
      return { view: 'reset-password' };
    case 'mentions-legales':
    case 'confidentialite':
    case 'cgu':
      return { view: 'legal', section: head };
    default:
      return { view: 'listings' };
  }
}

export function buildPath(route: Route): string {
  switch (route.view) {
    case 'landing':
      return '/';
    case 'listings':
      return '/annonces';
    case 'listing-detail':
      return `/annonces/${route.id}`;
    case 'create-listing':
      return '/annonces/nouvelle';
    case 'proposals':
      return '/propositions';
    case 'proposal-detail':
      return `/propositions/${route.id}`;
    case 'exchanges':
      return '/echanges';
    case 'profile':
      return '/profil';
    case 'public-profile':
      return `/membres/${route.id}`;
    case 'settings':
      return '/parametres';
    case 'admin':
      return '/admin';
    case 'auth':
      return route.mode === 'register' ? '/inscription' : '/connexion';
    case 'reset-password':
      return '/reinitialiser-mot-de-passe';
    case 'legal':
      return `/${route.section}`;
  }
}

const BASE_TITLE = 'BonTroc';

export function titleFor(route: Route, detail?: string): string {
  const withDetail = (label: string) => (detail ? `${detail} · ${label} · ${BASE_TITLE}` : `${label} · ${BASE_TITLE}`);
  switch (route.view) {
    case 'landing':
      return 'BonTroc — Troc en ligne : services, objets et échanges';
    case 'listings':
      return `Annonces · ${BASE_TITLE}`;
    case 'listing-detail':
      return withDetail('Annonce');
    case 'create-listing':
      return `Publier une annonce · ${BASE_TITLE}`;
    case 'proposals':
      return `Mes propositions · ${BASE_TITLE}`;
    case 'proposal-detail':
      return withDetail('Proposition');
    case 'exchanges':
      return `Mes échanges · ${BASE_TITLE}`;
    case 'profile':
      return `Mon profil · ${BASE_TITLE}`;
    case 'public-profile':
      return withDetail('Profil');
    case 'settings':
      return `Paramètres · ${BASE_TITLE}`;
    case 'admin':
      return `Administration · ${BASE_TITLE}`;
    case 'auth':
      return route.mode === 'register' ? `Créer un compte · ${BASE_TITLE}` : `Connexion · ${BASE_TITLE}`;
    case 'reset-password':
      return `Nouveau mot de passe · ${BASE_TITLE}`;
    case 'legal':
      return `${
        route.section === 'cgu'
          ? "Conditions générales d'utilisation"
          : route.section === 'confidentialite'
            ? 'Politique de confidentialité'
            : 'Mentions légales'
      } · ${BASE_TITLE}`;
  }
}

/** Pousse une nouvelle entrée d'historique si le chemin change. */
export function pushRoute(route: Route, replace = false, search = '') {
  const path = buildPath(route);
  const query = route.view === 'listings' && search ? `?q=${encodeURIComponent(search)}` : '';
  const url = path + query;
  if (window.location.pathname + window.location.search === url) return;
  if (replace) window.history.replaceState({ path }, '', url);
  else window.history.pushState({ path }, '', url);
}

export function currentRoute(): Route {
  return parsePath(window.location.pathname);
}

/** Terme de recherche passé dans l'URL (`/annonces?q=velo`), utilisé au premier rendu. */
export function currentSearchTerm(): string {
  try {
    return (new URLSearchParams(window.location.search).get('q') ?? '').slice(0, 100);
  } catch {
    return '';
  }
}
