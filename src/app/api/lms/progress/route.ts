export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { awardXP } from '@/lib/gamification/xpEngine';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { courseId, lessonId, percentWatched } = await request.json();

  if (!courseId || !lessonId || percentWatched === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Upsert enrollment
  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('*')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .single();

  if (!enrollment) {
    await supabase.from('course_enrollments').insert({
      user_id: user.id,
      course_id: courseId,
      progress: Math.min(percentWatched, 100),
    });
  } else {
    const newProgress = Math.max(enrollment.progress, percentWatched);
    await supabase
      .from('course_enrollments')
      .update({ progress: Math.min(newProgress, 100) })
      .eq('id', enrollment.id);
  }

  // Award XP for lesson completion (>= 90%)
  let xpAwarded = false;
  if (percentWatched >= 90) {
    await awardXP(user.id, 'completeCourseLesson');
    xpAwarded = true;
  }

  return NextResponse.json({
    success: true,
    xpAwarded,
    lessonId,
    percentWatched,
  });
}
