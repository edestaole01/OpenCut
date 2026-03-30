-- Migration to add RLS policies for ai_video_analyses

-- Policy to allow users to select only their own analyses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ai_video_analyses' AND policyname = 'Users can view their own analyses'
    ) THEN
        CREATE POLICY "Users can view their own analyses" ON "ai_video_analyses"
        FOR SELECT
        USING (user_id = auth.uid());
    END IF;
END $$;

-- Policy to allow users to insert their own analyses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ai_video_analyses' AND policyname = 'Users can insert their own analyses'
    ) THEN
        CREATE POLICY "Users can insert their own analyses" ON "ai_video_analyses"
        FOR INSERT
        WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

-- Policy to allow users to delete their own analyses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ai_video_analyses' AND policyname = 'Users can delete their own analyses'
    ) THEN
        CREATE POLICY "Users can delete their own analyses" ON "ai_video_analyses"
        FOR DELETE
        USING (user_id = auth.uid());
END IF;
END $$;
