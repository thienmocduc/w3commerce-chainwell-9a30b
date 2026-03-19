'use client';

import { useUser } from '@/hooks/useUser';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { XPProgressBar } from '@/components/gamification/XPProgressBar';
import { Button } from '@/components/ui/button';
import type { Course } from '@/lib/types/database.types';

export default function AcademyPage() {
  const { profile } = useUser();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      const supabase = createClient();
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: true });
      setCourses(data ?? []);
      setLoading(false);
    }
    fetchCourses();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Hero */}
      <div className="mb-8 rounded-xl bg-gradient-to-r from-primary/10 to-purple-500/10 p-8">
        <h1 className="text-3xl font-bold">KOC Academy</h1>
        <p className="mt-2 text-muted-foreground">
          Become a certified KOC in 7 days. Learn, earn, and grow.
        </p>
        {profile && (
          <div className="mt-4 max-w-sm">
            <XPProgressBar xp={profile.xp_points} level={profile.level} />
          </div>
        )}
      </div>

      {/* Course grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          Courses coming soon! Check back later.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div key={course.id} className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md">
              <div className="mb-3 h-32 rounded-md bg-muted flex items-center justify-center text-muted-foreground text-sm">
                Course Thumbnail
              </div>
              <h3 className="font-medium">{course.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {course.description}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-bold">
                  {Number(course.price) === 0 ? 'Free' : `$${course.price}`}
                </span>
                <Button size="sm" variant="outline">
                  {Number(course.price) === 0 ? 'Start Learning' : 'Enroll'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
