import { NextResponse } from 'next/server';
import db from '../../../../../lib/reviews-db';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json();
    const vote = body && body.vote;

    if (!['up', 'down', 'clear'].includes(vote)) {
      return NextResponse.json({ error: 'invalid vote' }, { status: 400 });
    }

    const counts = await db.applyVote(id, vote as 'up' | 'down' | 'clear');
    return NextResponse.json({ helpfulUp: counts.helpfulUp, helpfulDown: counts.helpfulDown });
  } catch (e) {
    return NextResponse.json({ helpfulUp: 0, helpfulDown: 0 }, { status: 500 });
  }
}
