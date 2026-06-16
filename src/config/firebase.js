const DEFAULT_DATABASE_URL = 'https://test-prod-app-81915-default-rtdb.firebaseio.com';

export const FIREBASE_DATABASE_URL = (process.env.REACT_APP_FIREBASE_DATABASE_URL || DEFAULT_DATABASE_URL).replace(
    /\/$/,
    ''
);

export const FIREBASE_PROJECT_ID = process.env.REACT_APP_FIREBASE_PROJECT_ID || 'test-prod-app-81915';

export const firebaseDbUrl = (path) => `${FIREBASE_DATABASE_URL}/${String(path || '').replace(/^\//, '')}`;

export const FIREBASE_FUNCTIONS_BASE =
    process.env.REACT_APP_FIREBASE_FUNCTIONS_BASE || `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net`;
