export type Officer = {
  id: string;
  name: string;
  position: string;
  photo: string;
  linkedin: string;
};

export type Department = {
  id: string;
  name: string;
  officers: Officer[];
};

export const departments: Department[] = [
  {
    id: 'leadership',
    name: 'Leadership Team',
    officers: [
      { id: 'jonathan-gaucin', name: 'Jonathan Gaucin', position: 'President', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com/in/jonathangaucin' },
      { id: 'jose-conde', name: 'Jose Conde', position: 'Vice President Internal', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com/in/jose-conde-ab78002aa' },
      { id: 'clark-horak', name: 'Clark Horak', position: 'Vice President External', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com/in/clark-horak-77b158228' },
      { id: 'nilesh-garg', name: 'Nilesh Garg', position: 'Secretary', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com/in/' },
      { id: 'mai-redfearn', name: 'Mai Redfearn', position: 'Treasurer', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com/in/mnredfearn' },
    ],
  },
  {
    id: 'marketing',
    name: 'Event/Marketing Team',
    officers: [
      { id: 'gyan-gabilan', name: 'Gyan Andrei Gabilan', position: 'Marketing Committee', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com/in/gyanandreigabilan' },
      { id: 'khyaati-khanna', name: 'Khyaati Khanna', position: 'Marketing Committee', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com/in/khyaati-khanna' },
      { id: 'katherine-hernandez', name: 'Katherine Hernandez', position: 'Marketing Committee', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com/in/katherine-hernandez-5a3438328' },
    ],
  },
  {
    id: 'workshop',
    name: 'Workshop Team',
    officers: [
      { id: 'isaac-gonzalez', name: 'Isaac Gonzalez', position: 'Workshop Committee', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com/in/isaac-gonzalez-234328337' },
      { id: 'asibong-ephraim', name: 'Asibong Sylvia Ephraim', position: 'Workshop Committee', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com/in/asibong-ephraim-9685b6330' },
    ],
  },
  {
    id: 'webmaster',
    name: 'Webmaster Team',
    officers: [{ id: 'adam', name: 'Adam', position: 'Webmaster Committee', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' }],
  },
  {
    id: 'technical',
    name: 'Technical Team',
    officers: [{ id: 'dylan', name: 'Dylan', position: 'Technical Officer', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' }],
  },
  {
    id: 'projects',
    name: 'Project Team',
    officers: [{ id: 'fredy', name: 'Fredy', position: 'Projects Officer', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' }],
  },
];
