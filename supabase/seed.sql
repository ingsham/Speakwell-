-- DEMO CONTENT: sample exercises only (is_demo = true). Safe to delete.
insert into public.practice_exercises (category, title, prompt, suggested_seconds, is_demo) values
 ('warm-up','Gentle breathing','Breathe slowly, then say your name and one thing you enjoyed today. Pausing is welcome.',60,true),
 ('introduction','Introduce yourself','Tell a new friend who you are and what you like to do. Go at your own pace.',120,true),
 ('storytelling','A favourite place','Describe a place that makes you feel calm. What do you see and hear?',180,true),
 ('conversation','Ordering food','Practise ordering your favourite meal as if at a restaurant.',90,true),
 ('reading','Read aloud','Read any paragraph you like out loud. Repeat words or stop whenever you want.',120,true),
 ('opinion','Share an opinion','What is one thing you would change about your town? Explain why.',150,true),
 ('presentation','Mini presentation','Teach someone something you know well in two minutes.',120,true);
-- Bootstrap your FIRST ADMIN after signing up (replace the UUID with yours from Authentication > Users):
-- insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000000', 'admin');
