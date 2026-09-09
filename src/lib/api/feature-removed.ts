import { NextResponse } from 'next/server';

export function featureRemovedResponse(feature = 'This feature') {
  return NextResponse.json(
    { error: 'FEATURE_REMOVED', message: `${feature} is no longer available.` },
    { status: 410 },
  );
}
