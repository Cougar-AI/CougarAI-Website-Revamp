// UH IT "supported classrooms" building list, used to power the searchable
// building picker in the admin event create/edit modal.
//
// Coordinates are approximate — sourced from general campus maps/knowledge
// for the purpose of map-centering and geofenced check-in radius validation,
// NOT surveyed rooftop-precise coordinates. Buildings where the exact
// coordinate is uncertain are marked with a `// TODO: verify coords` comment
// so they can be refined later against an authoritative campus map/GIS layer.

export interface UhClassroomBuilding {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

export const UH_CLASSROOM_BUILDINGS: UhClassroomBuilding[] = [
  // ---- Main campus ----
  { code: 'AH', name: 'Agnes Arnold Hall', lat: 29.7213, lon: -95.3418 },
  { code: 'ARC', name: 'College of Architecture', lat: 29.7207, lon: -95.3457 }, // TODO: verify coords
  { code: 'BL', name: 'Bates Law', lat: 29.7148, lon: -95.3417 }, // TODO: verify coords
  { code: 'C', name: 'Roy Gustav Cullen Building', lat: 29.7212, lon: -95.3409 },
  { code: 'CAM', name: 'Isabel C. Cameron Building', lat: 29.7222, lon: -95.3412 }, // TODO: verify coords
  { code: 'CBB', name: 'University Classroom & Business Building', lat: 29.7188, lon: -95.3413 },
  { code: 'CEMO', name: 'Michael J. Cemo Hall', lat: 29.7185, lon: -95.3405 }, // TODO: verify coords
  { code: 'CHC', name: 'Conrad Hilton College of Global Hospitality Leadership', lat: 29.7183, lon: -95.3399 },
  { code: 'COM', name: 'Jack J. Valenti School of Communication', lat: 29.7203, lon: -95.3437 }, // TODO: verify coords
  { code: 'CV', name: 'Cougar Village', lat: 29.7228, lon: -95.3436 },
  { code: 'D', name: 'Cullen College of Engineering 1', lat: 29.7205, lon: -95.3430 },
  { code: 'D2', name: 'Engineering Lecture Hall', lat: 29.7207, lon: -95.3432 }, // TODO: verify coords
  { code: 'D3', name: 'Cullen College of Engineering Building', lat: 29.7205, lon: -95.3430 },
  { code: 'ERP9', name: 'ConocoPhillips Petroleum Engineering', lat: 29.7196, lon: -95.3444 }, // TODO: verify coords
  { code: 'ESG', name: 'Elgin Street Garage', lat: 29.7175, lon: -95.3419 }, // TODO: verify coords
  { code: 'F', name: 'Lamar Fleming, Jr. Building', lat: 29.7211, lon: -95.3441 }, // TODO: verify coords
  { code: 'FA', name: 'Fine Arts Building', lat: 29.7237, lon: -95.3437 }, // TODO: verify coords
  { code: 'GAR', name: 'Susanna Garrison Hall', lat: 29.7233, lon: -95.3442 }, // TODO: verify coords
  { code: 'H', name: 'Fred J. Heyne Building', lat: 29.7198, lon: -95.3439 }, // TODO: verify coords
  { code: 'HBS1', name: 'Health & Biomedical Sciences 1', lat: 29.7168, lon: -95.3402 }, // TODO: verify coords
  { code: 'HBS2', name: 'Health & Biomedical Sciences 2', lat: 29.7170, lon: -95.3400 }, // TODO: verify coords
  { code: 'JDA', name: 'J. Davis Armistead Building', lat: 29.7218, lon: -95.3406 }, // TODO: verify coords
  { code: 'KH', name: 'Max Krost Hall', lat: 29.7220, lon: -95.3404 }, // TODO: verify coords
  { code: 'L', name: 'M.D. Anderson Library', lat: 29.7215, lon: -95.3402 },
  { code: 'M', name: 'Charles F. McElhinney Hall', lat: 29.7226, lon: -95.3408 }, // TODO: verify coords
  { code: 'MEL', name: 'Melcher Gymnasium', lat: 29.7178, lon: -95.3455 }, // TODO: verify coords
  { code: 'MH', name: 'Leroy and Lucile Melcher Hall', lat: 29.7181, lon: -95.3396 },
  { code: 'MSM', name: 'Rebecca & John J. Moores School of Music', lat: 29.7239, lon: -95.3441 }, // TODO: verify coords
  { code: 'PGH', name: 'Philip Guthrie Hoffman Hall', lat: 29.7218, lon: -95.3428 },
  { code: 'S', name: 'Science Building', lat: 29.7193, lon: -95.3427 }, // TODO: verify coords
  { code: 'SEC', name: 'Science and Engineering Classrooms', lat: 29.7195, lon: -95.3430 },
  { code: 'SR', name: 'Science & Research Building', lat: 29.7189, lon: -95.3433 }, // TODO: verify coords
  { code: 'SR2', name: 'Science & Research 2', lat: 29.7187, lon: -95.3435 }, // TODO: verify coords
  { code: 'STAD', name: 'TDECU Stadium', lat: 29.7211, lon: -95.3490 },
  { code: 'SW', name: 'Graduate School of Social Work', lat: 29.7145, lon: -95.3414 }, // TODO: verify coords
  { code: 'TU2', name: 'Teaching Unit 2', lat: 29.7201, lon: -95.3446 }, // TODO: verify coords
  { code: 'T2', name: 'College of Liberal Arts and Social Sciences', lat: 29.7203, lon: -95.3448 }, // TODO: verify coords
  { code: 'WT', name: 'C.W. Mitchell Center for the Arts/Wortham Theater', lat: 29.7241, lon: -95.3444 }, // TODO: verify coords

  // ---- UH Sugar Land ----
  { code: 'AMG', name: 'Academic & Administration Building (UH Sugar Land)', lat: 29.5744, lon: -95.6558 }, // TODO: verify coords
  { code: 'BH2', name: 'Building 2 (UH Sugar Land)', lat: 29.5747, lon: -95.6555 }, // TODO: verify coords
  { code: 'SAB1', name: 'Sugar Academic Building 1 (UH Sugar Land)', lat: 29.5741, lon: -95.6561 }, // TODO: verify coords

  // ---- UH Katy ----
  { code: 'KAB1', name: 'Katy Academic Building 1 (UH Katy)', lat: 29.7869, lon: -95.8302 }, // TODO: verify coords
];
