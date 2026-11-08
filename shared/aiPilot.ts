export const isAiPilotEnabled = (
  isDevelopment: boolean,
  isProduction: boolean,
  pilotFlag: string | undefined,
  origin: string | undefined,
  isLoggedIn: boolean
): boolean => {
  const allowedEnvironment =
    (isDevelopment && origin === 'http://localhost:3001') ||
    (isProduction && origin === 'https://titantrack-clean.vercel.app');

  return pilotFlag === 'true' && isLoggedIn && allowedEnvironment;
};
