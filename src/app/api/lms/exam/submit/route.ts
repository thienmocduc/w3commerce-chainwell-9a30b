export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { awardXP } from '@/lib/gamification/xpEngine';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId, answers } = await request.json();

  if (!courseId || !answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'courseId and answers required' }, { status: 400 });
  }

  // Fetch course content with correct answers
  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  const examQuestions = (course.content as any)?.examQuestions ?? [];
  if (examQuestions.length === 0) {
    return NextResponse.json({ error: 'No exam questions found' }, { status: 400 });
  }

  // Calculate score
  let correctCount = 0;
  for (const question of examQuestions) {
    if (answers[question.id] === question.correctAnswer) {
      correctCount++;
    }
  }

  const score = Math.round((correctCount / examQuestions.length) * 100);
  const passed = score >= 70;

  if (passed) {
    // Award XP
    const xpResult = await awardXP(user.id, 'passKOCExam');

    // Update enrollment
    await supabase
      .from('course_enrollments')
      .update({
        completed: true,
        progress: 100,
      })
      .eq('user_id', user.id)
      .eq('course_id', courseId);

    // Upgrade to KOC role if currently user
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'user') {
      await supabase
        .from('users')
        .update({ role: 'koc' })
        .eq('id', user.id);
    }

    // Note: In production, mint KOC Badge NFT here via W3CNFT.mintKOCBadge()

    return NextResponse.json({
      passed: true,
      score,
      correctCount,
      totalQuestions: examQuestions.length,
      xpAwarded: 1000,
      newLevel: xpResult.newLevel,
      leveledUp: xpResult.leveledUp,
      message: 'Congratulations! You are now a certified KOC!',
    });
  }

  return NextResponse.json({
    passed: false,
    score,
    correctCount,
    totalQuestions: examQuestions.length,
    message: 'You need 70% to pass. Keep studying!',
  });
}
