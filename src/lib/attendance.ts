export function getHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dphi / 2) * Math.sin(dphi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) * Math.sin(dlambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export function detectPhotoSource(fileName: string, delaySeconds: number): { source: 'LIVE (Camera)' | 'UPLOADED'; isFastOrForbidden: boolean } {
  const fn = (fileName || '').toLowerCase();
  const isFast = delaySeconds < 5.0;
  const containsForbidden =
    fn.includes('whatsapp') ||
    fn.includes('screenshot') ||
    fn.includes('download') ||
    fn.includes('telegram');

  if (isFast || containsForbidden) {
    return { source: 'UPLOADED', isFastOrForbidden: true };
  }
  return { source: 'LIVE (Camera)', isFastOrForbidden: false };
}
