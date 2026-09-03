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
      { id: 'issac', name: 'Isaac Gonzalez', position: 'President', photo: '/officerHeadshots/Isaac Gonzalez.png', linkedin: 'https://www.linkedin.com/in/issac-gonzalez28/' },
      { id: 'chuck', name: 'Truc "Chuck" Le', position: 'Vice President Internal', photo: '/officerHeadshots/Truc Le.jpeg', linkedin: 'https://www.linkedin.com/in/franklinstyle' },
      { id: 'ashley', name: 'Ashley Nguyen', position: 'Vice President External', photo: '/officerHeadshots/Ashley Nguyen.jpeg', linkedin: 'https://linkedin.com/in/ashleynguyencs/' },
    ],
  },
  {
    id: 'advisors',
    name: 'Advisors',
    officers: [
      { id: 'jose-advisor', name: 'Jose Conde', position: 'Advisor', photo: '/officerHeadshots/Jose Conde.png', linkedin: 'https://www.linkedin.com/in/jose-conde-ab78002aa/' },
      { id: 'jonathan-advisor', name: 'Jonathan Gaucin', position: 'Advisor', photo: '/officerHeadshots/Jonathan Gaucin.png', linkedin: 'https://www.linkedin.com/in/jonathangaucin/' },
      { id: 'clark-advisor', name: 'Clark Horak', position: 'Advisor', photo: '/officerHeadshots/Clark Horak.png', linkedin: 'https://www.linkedin.com/in/clark-horak-77b158228/' },
      { id: 'jason-advisor', name: 'Jason Quach', position: 'Advisor', photo: '/officerHeadshots/Jason Quach.png', linkedin: 'https://www.linkedin.com/in/jason-quach-478a6225b/' },
      { id: 'katherine-advisor', name: 'Katherine Hernandez', position: 'Advisor', photo: '/officerHeadshots/Katherine Hernandez.png', linkedin: 'https://www.linkedin.com/in/katherine-hernandez-5a3438328/' },
    ],
  },
  {
    id: 'webmaster',
    name: 'Webmasters',
    officers: [
      { id: 'tj', name: 'TJ Papillion', position: 'Webmaster Director', photo: '/officerHeadshots/Theron Papillion.png', linkedin: 'https://www.linkedin.com/in/tpapillionjr/' },
      { id: 'liz', name: 'Lizzie Saucedo', position: 'Webmaster', photo: '/officer_photo_blank.png', linkedin: 'https://www.linkedin.com/in/lizzie-saucedo-747b08334/' },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    officers: [
    ],
  },
  {
    id: 'corporate-relations',
    name: 'Corporate Relations',
    officers: [
      { id: 'christian', name: 'Christian Brubaker', position: 'Corporate Relations', photo: '/officerHeadshots/Christian Brubaker.jpeg', linkedin: 'https://www.linkedin.com/in/christbru/' },
      { id: 'gideon', name: 'Gideon Amoah', position: 'Corporate Relations', photo: '/officerHeadshots/Gideon Amoah.jpeg', linkedin: 'https://www.linkedin.com/in/gideonamoah74/' },
    ],
  },
  {
    id: 'events',
    name: 'Events Directors',
    officers: [
      { id: 'zayna', name: 'Zainab Sohail', position: 'Event Director', photo: '/officerHeadshots/Zainab Sohail.png', linkedin: 'https://www.linkedin.com/in/zainab11' },
    ],
  },
  {
    id: 'workshops-projects',
    name: 'Workshops / Projects',
    officers: [
      { id: 'alaric', name: 'Alaric Varghese', position: 'Project Officer', photo: '/officerHeadshots/Alaric Varghese.jpeg', linkedin: 'https://www.linkedin.com/in/alaric-varghese' },
      { id: 'saleh', name: 'Saleh Khan', position: 'Projects Officer', photo: '/officerHeadshots/Saleh Khan.jpeg', linkedin: 'https://www.linkedin.com/in/khansaleh' },
    ],
  },
  {
    id: 'historians',
    name: 'Historians',
    officers: [
      { id: 'leon', name: 'Leon Lu', position: 'Historian', photo: '/officerHeadshots/Leon_Professional_Headshot.png', linkedin: 'https://www.linkedin.com/in/leon-l-24794a329/' },
    ],
  },
];
