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
    id: 'executive',
    name: 'Executive Board',
    officers: [
      { id: 'katherine', name: 'Katherine', position: 'President', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'jason', name: 'Jason', position: 'Vice President Internal', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'nehaa', name: 'Nehaa', position: 'Vice President External', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'ashley', name: 'Ashley', position: 'Secretary', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'kaitlyn', name: 'Kaitlyn', position: 'Treasurer', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'advisors',
    name: 'Advisors',
    officers: [
      { id: 'jose-advisor', name: 'Jose', position: 'Advisor', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'jonathan-advisor', name: 'Jonathan', position: 'Advisor', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'clark-advisor', name: 'Clark', position: 'Advisor', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'historians',
    name: 'Historians',
    officers: [
      { id: 'leon', name: 'Leon', position: 'Historian', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    officers: [
      { id: 'fatima', name: 'Fatima', position: 'Marketing Director', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'parinaz', name: 'Parinaz', position: 'Marketing Committee', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'events',
    name: 'Events Directors',
    officers: [
      { id: 'zayna', name: 'Zayna', position: 'Event Director', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'chuck', name: 'Chuck', position: 'Event Director', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'workshops-projects',
    name: 'Workshops / Projects',
    officers: [
      { id: 'isaac-gonzalez', name: 'Isaac Gonzalez', position: 'Technical Officer', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'ndahi', name: 'Ndähi', position: 'Workshop Committee', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'juzer', name: 'Juzer', position: 'Workshop Committee', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'jemilu', name: 'Jemilu', position: 'Project Officer', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'christbru', name: 'Christbru', position: 'Project Officer', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'arham', name: 'Arham', position: 'Projects Officer', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'webmaster',
    name: 'Webmasters',
    officers: [
      { id: 'isa', name: 'Isa', position: 'Webmaster Director', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'tj', name: 'TJ', position: 'Webmaster', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'liz', name: 'Liz', position: 'Webmaster', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'corporate-relations',
    name: 'Corporate Relations',
    officers: [
      { id: 'reyna', name: 'Reyna', position: 'Corporate Relations', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'gideon', name: 'Gideon', position: 'Corporate Relations', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'anitra', name: 'Anitra', position: 'Corporate Relations', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
];
