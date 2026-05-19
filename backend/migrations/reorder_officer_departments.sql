UPDATE officer_positions SET sort_order = CASE department
  WHEN 'Executive Board'      THEN 100
  WHEN 'Advisors'             THEN 200
  WHEN 'Webmasters'           THEN 300
  WHEN 'Marketing'            THEN 400
  WHEN 'Corporate Relations'  THEN 500
  WHEN 'Events Directors'     THEN 600
  WHEN 'Workshops / Projects' THEN 700
  WHEN 'Historians'           THEN 800
  ELSE 900
END;
