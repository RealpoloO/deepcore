/**
 * @fileoverview Middleware d'authentification centralisé
 * @module middleware/auth
 */

/**
 * Middleware pour vérifier l'authentification de l'utilisateur
 * Vérifie la présence d'un userId dans la session
 *
 * @param {import('express').Request} req - Requête Express
 * @param {import('express').Response} res - Réponse Express
 * @param {import('express').NextFunction} next - Fonction next
 * @returns {void}
 *
 * @example
 * router.get('/protected', requireAuth, (req, res) => {
 *   // req.session.userId est garanti d'exister ici
 *   res.json({ userId: req.session.userId });
 * });
 */
export function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

export default requireAuth;
