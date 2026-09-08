import { withLockedCustomer, reserveBandwidthBytes, setUserBandwidthUsed } from '@/lib/storage/quota-reservation';

export async function reserveDownloadBandwidth(params: {
  userId: string;
  bytes: bigint;
}): Promise<{ ok: true } | { ok: false; reason: 'bandwidth_exceeded' | 'not_found' }> {
  try {
    return await withLockedCustomer(params.userId, async (user, client) => {
      const reservation = reserveBandwidthBytes(user, params.bytes);
      if (!reservation.ok) {
        return { ok: false, reason: 'bandwidth_exceeded' };
      }

      await setUserBandwidthUsed(
        client,
        params.userId,
        reservation.nextBandwidthUsed,
      );

      return { ok: true };
    });
  } catch {
    return { ok: false, reason: 'not_found' };
  }
}
