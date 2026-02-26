
-- Policies for user_roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Policies for profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for whatsapp_instances
CREATE POLICY "Users manage own whatsapp instance" ON public.whatsapp_instances FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for whatsapp_conversations
CREATE POLICY "Users manage own conversations" ON public.whatsapp_conversations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for whatsapp_ai_config
CREATE POLICY "Users manage own ai config" ON public.whatsapp_ai_config FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for whatsapp_ai_sessions
CREATE POLICY "Users manage own ai sessions" ON public.whatsapp_ai_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for whatsapp_pending_responses
CREATE POLICY "Users manage own pending responses" ON public.whatsapp_pending_responses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for contacts
CREATE POLICY "Users manage own contacts" ON public.contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for appointments
CREATE POLICY "Users manage own appointments" ON public.appointments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for appointment_slots
CREATE POLICY "Users manage own appointment slots" ON public.appointment_slots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for notification_contacts
CREATE POLICY "Users manage own notification contacts" ON public.notification_contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for knowledge_base_documents
CREATE POLICY "Users manage own knowledge docs" ON public.knowledge_base_documents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for platform_settings
CREATE POLICY "Users manage own platform settings" ON public.platform_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for entrevistas_config
CREATE POLICY "Users manage own entrevistas config" ON public.entrevistas_config FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
