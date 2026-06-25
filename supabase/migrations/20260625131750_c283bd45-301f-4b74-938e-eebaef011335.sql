
CREATE OR REPLACE FUNCTION public.clone_igreen_scenario_content(
  _source_account uuid,
  _target_account uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src_scn record;
  tgt_scn_id uuid;
  src_day record;
  new_day_id uuid;
  src_msg record;
  new_msg_id uuid;
  copied_scn int := 0;
  copied_days int := 0;
  copied_msgs int := 0;
  copied_items int := 0;
BEGIN
  IF _source_account IS NULL OR _target_account IS NULL OR _source_account = _target_account THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid accounts');
  END IF;

  FOR src_scn IN
    SELECT id, scenario_key
      FROM public.igreen_scenarios
     WHERE account_id = _source_account
       AND scenario_key IS NOT NULL
  LOOP
    SELECT id INTO tgt_scn_id
      FROM public.igreen_scenarios
     WHERE account_id = _target_account
       AND scenario_key = src_scn.scenario_key
     LIMIT 1;

    IF tgt_scn_id IS NULL THEN CONTINUE; END IF;

    -- skip if target already has days
    IF EXISTS (SELECT 1 FROM public.igreen_scenario_days WHERE scenario_id = tgt_scn_id) THEN
      CONTINUE;
    END IF;

    copied_scn := copied_scn + 1;

    FOR src_day IN
      SELECT id, day_number, enabled
        FROM public.igreen_scenario_days
       WHERE scenario_id = src_scn.id
       ORDER BY day_number
    LOOP
      INSERT INTO public.igreen_scenario_days (scenario_id, day_number, enabled)
        VALUES (tgt_scn_id, src_day.day_number, src_day.enabled)
        RETURNING id INTO new_day_id;
      copied_days := copied_days + 1;

      FOR src_msg IN
        SELECT id, period, label
          FROM public.igreen_scenario_messages
         WHERE day_id = src_day.id
      LOOP
        INSERT INTO public.igreen_scenario_messages (day_id, period, label)
          VALUES (new_day_id, src_msg.period, src_msg.label)
          RETURNING id INTO new_msg_id;
        copied_msgs := copied_msgs + 1;

        INSERT INTO public.igreen_scenario_items
          (message_id, position, type, content, caption, media_url, media_mime, media_filename, delay_value, delay_unit)
        SELECT new_msg_id, position, type, content, caption, media_url, media_mime, media_filename, delay_value, delay_unit
          FROM public.igreen_scenario_items
         WHERE message_id = src_msg.id;

        GET DIAGNOSTICS copied_items = ROW_COUNT;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'scenarios', copied_scn,
    'days', copied_days,
    'messages', copied_msgs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.clone_igreen_scenario_content(uuid, uuid) TO service_role;
