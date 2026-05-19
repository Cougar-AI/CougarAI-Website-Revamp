ALTER TABLE officers
  ADD CONSTRAINT officers_student_id_unique UNIQUE (student_id);
