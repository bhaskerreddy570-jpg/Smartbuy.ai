import { featureRemovedResponse } from '@/lib/api/feature-removed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return featureRemovedResponse('Mobile contacts sync');
}

export async function POST() {
  return featureRemovedResponse('Mobile contacts sync');
}

export async function PATCH() {
  return featureRemovedResponse('Mobile contacts sync');
}
