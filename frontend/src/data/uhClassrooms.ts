// University of Houston MAIN CAMPUS classroom buildings, used to power the
// searchable building picker in the admin event create/edit modal.
//
// Coordinates are OpenStreetMap building-footprint centroids (WGS84), verified
// against the UH campus map and official UH building-number list. They are
// accurate to well within ~100m — suitable for map-centering and geofenced
// check-in. (TU2 is a best-effort estimate; see note.)

export interface UhClassroomBuilding {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

export const UH_CLASSROOM_BUILDINGS: UhClassroomBuilding[] = [
  { code: 'AH', name: 'Agnes Arnold Hall', lat: 29.72216, lon: -95.34419 },
  { code: 'ARC', name: 'College of Architecture', lat: 29.72447, lon: -95.34151 },
  { code: 'BL', name: 'Bates Law', lat: 29.72415, lon: -95.33799 },
  { code: 'C', name: 'Roy Gustav Cullen Building', lat: 29.72004, lon: -95.34497 },
  { code: 'CAM', name: 'Isabel C. Cameron Building', lat: 29.71789, lon: -95.34795 },
  { code: 'CBB', name: 'University Classroom & Business Building', lat: 29.72158, lon: -95.34052 },
  { code: 'CEMO', name: 'Michael J. Cemo Hall', lat: 29.72187, lon: -95.34012 },
  { code: 'CHC', name: 'Conrad Hilton College of Global Hospitality Leadership', lat: 29.71903, lon: -95.34132 },
  { code: 'COM', name: 'Jack J. Valenti School of Communication', lat: 29.72423, lon: -95.34345 },
  { code: 'CV', name: 'Cougar Village', lat: 29.71789, lon: -95.34342 },
  { code: 'D', name: 'Cullen College of Engineering 1', lat: 29.72287, lon: -95.34139 },
  { code: 'D2', name: 'Engineering Lecture Hall', lat: 29.72272, lon: -95.34093 },
  { code: 'D3', name: 'Cullen College of Engineering Building 2', lat: 29.72351, lon: -95.34117 },
  { code: 'ERP9', name: 'ConocoPhillips Petroleum Engineering', lat: 29.71887, lon: -95.32816 },
  { code: 'ESG', name: 'Elgin Street Garage', lat: 29.72529, lon: -95.33975 },
  { code: 'F', name: 'Lamar Fleming, Jr. Building', lat: 29.72179, lon: -95.34587 },
  { code: 'FA', name: 'Fine Arts Building', lat: 29.72479, lon: -95.34265 },
  { code: 'GAR', name: 'Susanna Garrison Hall', lat: 29.72518, lon: -95.34777 },
  { code: 'H', name: 'Fred J. Heyne Building', lat: 29.72044, lon: -95.34641 },
  { code: 'HBS1', name: 'Health & Biomedical Sciences 1', lat: 29.71673, lon: -95.33866 },
  { code: 'HBS2', name: 'Health & Biomedical Sciences 2', lat: 29.71613, lon: -95.33806 },
  { code: 'JDA', name: 'J. Davis Armistead Building', lat: 29.71633, lon: -95.33907 },
  { code: 'KH', name: 'Max Krost Hall', lat: 29.72393, lon: -95.33872 },
  { code: 'L', name: 'M.D. Anderson Library', lat: 29.72097, lon: -95.34200 },
  { code: 'M', name: 'Charles F. McElhinney Hall', lat: 29.72122, lon: -95.34644 },
  { code: 'MEL', name: 'Melcher Gymnasium', lat: 29.72537, lon: -95.34838 },
  { code: 'MH', name: 'Leroy and Lucile Melcher Hall', lat: 29.72100, lon: -95.33943 },
  { code: 'MSM', name: 'Rebecca & John J. Moores School of Music', lat: 29.72543, lon: -95.34443 },
  { code: 'PGH', name: 'Philip Guthrie Hoffman Hall', lat: 29.72160, lon: -95.34366 },
  { code: 'S', name: 'Science Building', lat: 29.72141, lon: -95.34457 },
  { code: 'SEC', name: 'Science and Engineering Classrooms', lat: 29.72340, lon: -95.34567 },
  { code: 'SR', name: 'Science & Research Building 1', lat: 29.72297, lon: -95.34524 },
  { code: 'SR2', name: 'Science & Research 2', lat: 29.72389, lon: -95.34477 },
  { code: 'STAD', name: 'TDECU Stadium', lat: 29.72193, lon: -95.34932 },
  { code: 'SW', name: 'Graduate School of Social Work', lat: 29.72287, lon: -95.34378 },
  // TU2: no OSM feature carries the "Teaching Unit 2" name; coordinate is a
  // best-effort estimate at its known NE-corner location (near Bates Law).
  { code: 'TU2', name: 'Teaching Unit 2', lat: 29.72445, lon: -95.33861 },
  { code: 'T2', name: 'College of Liberal Arts and Social Sciences', lat: 29.72331, lon: -95.34261 },
  { code: 'WT', name: 'C.W. Mitchell Center for the Arts/Wortham Theater', lat: 29.72437, lon: -95.34407 },
];
