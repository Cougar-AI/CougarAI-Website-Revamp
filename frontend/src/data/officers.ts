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
      { id: 'katherine', name: 'Katherine Hernandez', position: 'President', photo: '/officerHeadshots/Katherine Hernandez.png', linkedin: 'https://www.linkedin.com/in/katherine-hernandez-5a3438328/' },
      { id: 'jason', name: 'Jason Quach', position: 'Vice President Internal', photo: '/officerHeadshots/Jason Quach.png', linkedin: 'https://www.linkedin.com/in/jason-quach-478a6225b/' },
      { id: 'nehaa', name: 'Nehaa Balaji', position: 'Vice President External', photo: '/officerHeadshots/Nehaa Balaji.jpeg', linkedin: 'https://linkedin.com' },
      { id: 'ashley', name: 'Ashley Nguyen', position: 'Secretary', photo: '/officerHeadshots/Ashley Nguyen.jpeg', linkedin: 'https://linkedin.com' },
      { id: 'kaitlyn', name: 'Kaitlyn Le', position: 'Treasurer', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'advisors',
    name: 'Advisors',
    officers: [
      { id: 'jose-advisor', name: 'Jose Conde', position: 'Advisor', photo: '/officerHeadshots/Jose Conde.png', linkedin: 'https://www.linkedin.com/in/jose-conde-ab78002aa/' },
      { id: 'jonathan-advisor', name: 'Jonathan Gaucin', position: 'Advisor', photo: '/officerHeadshots/Jonathan Gaucin.png', linkedin: 'https://www.linkedin.com/in/jonathangaucin/' },
      { id: 'clark-advisor', name: 'Clark Horak', position: 'Advisor', photo: '/officerHeadshots/Clark Horak.png', linkedin: 'https://www.linkedin.com/in/clark-horak-77b158228/' },
    ],
  },
  {
    id: 'webmaster',
    name: 'Webmasters',
    officers: [
      { id: 'isa', name: 'Isabella', position: 'Webmaster Director', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'tj', name: 'TJ Papillion', position: 'Webmaster', photo: '/officerHeadshots/Theron Papillion.png', linkedin: 'https://linkedin.com' },
      { id: 'liz', name: 'Lizzie Sauseo', position: 'Webmaster', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    officers: [
      { id: 'fatima', name: 'Fatima Hussain', position: 'Marketing Director', photo: '/officerHeadshots/Fatima Hussain.png', linkedin: 'https://linkedin.com' },
      { id: 'parinaz', name: 'Parinaz Dargahi', position: 'Marketing Committee', photo: '/officerHeadshots/Parinaz Dargahi.jpeg', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'corporate-relations',
    name: 'Corporate Relations',
    officers: [
      { id: 'reyna', name: 'Reyna Obregon', position: 'Corporate Relations', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'gideon', name: 'Gideon', position: 'Corporate Relations', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'anitra', name: 'Anitra', position: 'Corporate Relations', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'events',
    name: 'Events Directors',
    officers: [
      { id: 'zayna', name: 'Zainab Sohail', position: 'Event Director', photo: '/officerHeadshots/Zainab Sohail.png', linkedin: 'https://www.linkedin.com/in/zainab11' },
      { id: 'chuck', name: 'Chuck', position: 'Event Director', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'workshops-projects',
    name: 'Workshops / Projects',
    officers: [
      { id: 'isaac-gonzalez', name: 'Isaac Gonzalez', position: 'Technical Officer', photo: '/officerHeadshots/Isaac Gonzalez.png', linkedin: 'https://www.linkedin.com/in/isaac-gonzalez-234328337/' },
      { id: 'ndahi', name: 'Ndähi', position: 'Workshop Committee', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'juzer', name: 'Juzer Abid', position: 'Workshop Committee', photo: '/officerHeadshots/Juzer Abid.png', linkedin: 'https://linkedin.com' },
      { id: 'jemilu', name: 'Jemilu', position: 'Project Officer', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'christbru', name: 'Christbru', position: 'Project Officer', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
      { id: 'arham', name: 'Arham', position: 'Projects Officer', photo: '/officer_photo_blank.png', linkedin: 'https://linkedin.com' },
    ],
  },
  {
    id: 'historians',
    name: 'Historians',
    officers: [
      { id: 'leon', name: 'Leon Lu', position: 'Historian', photo: '/officerHeadshots/Leon_Professional_Headshot.png', linkedin: 'https://linkedin.com' },
    ],
  },
];
