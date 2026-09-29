// Ces deux routes répondent 401 dans le cours normal des choses (mauvais mot de
// passe, visiteur anonyme) : ce n'est pas une session qui expire.
const AUTH_ROUTES = new Set(['/api/auth/login', '/api/auth/session'])

// Où envoyer l'utilisateur quand une route d'API répond 401 alors qu'il était
// connecté ; null si ce 401 ne signale pas une session expirée.
export function expiredSessionRedirect(
  url: string,
  status: number | undefined,
  loggedIn: boolean,
  currentPath: string,
): string | null {
  if (status !== 401 || !loggedIn) return null
  const path = url.split('?')[0] ?? ''
  if (!path.startsWith('/api/') || AUTH_ROUTES.has(path)) return null
  if (currentPath.startsWith('/login')) return '/login?expiree=1'
  return `/login?expiree=1&retour=${encodeURIComponent(currentPath)}`
}

// Le retour vient de l'URL, donc de n'importe qui : seul un chemin interne est
// suivi, sinon un lien piégé renverrait sur un autre site après la connexion.
export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
