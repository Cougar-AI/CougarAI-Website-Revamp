import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const departments = [
    {
        name: "Leadership Team",
        officers: [
            {
            name: "Jonathan Gaucin",
            position: "President",
            photo: "/officer_photo_blank.png",
            linkedin: "https://linkedin.com/in/jonathangaucin"
            },
            {
            name: "Jose Conde",
            position: "Vice President Interal",
            photo: "/officer_photo_blank.png",
            linkedin: "https://linkedin.com/in/jose-conde-ab78002aa"
            },
            {
            name: "Clark Horak",
            position: "Vice President Exteral",
            photo: "/officer_photo_blank.png",
            linkedin: "https://linkedin.com/in/clark-horak-77b158228"
            },
            {
            name: "Nilesh Garg",
            position: "Secretary",
            photo: "/officer_photo_blank.png",
            linkedin: "https://linkedin.com/in/"
            },
            {
            name: "Mai Redfearn",
            position: "Treasurer",
            photo: "/officer_photo_blank.png",
            linkedin: "https://linkedin.com/in/mnredfearn"
            }
        ]
    },
    {
        name: "Event/Marketing Team",
        officers: [
            {
            name: "Gyan Andrei Gabilan",
            position: "Marketing Committee",
            photo: "/officer_photo_blank.png",
            linkedin: "https://linkedin.com/in/gyanandreigabilan"
            },
            {
            name: "Khyaati Khanna",
            position: "Marketing Committee",
            photo: "/officer_photo_blank.png",
            linkedin: "https://linkedin.com/in/khyaati-khanna"
            },
            {
            name: "Katherine Hernandez",
            position: "Marketing Committee",
            photo: "/officer_photo_blank.png",
            linkedin: "https://linkedin.com/in/katherine-hernandez-5a3438328"
            }, 
        ]
    },
    {
        name: "Workshop Team",
        officers: [
        {
            name: "Isaac Gonzalez",
            position: "Workshop Commitee",
            photo: "/officer_photo_blank.png",
            linkedin: "https://linkedin.com/in/isaac-gonzalez-234328337"
        },
        {
          name: "Asibong Sylvia Ephraim",
          position: "Workshop Commitee",
          photo: "/officer_photo_blank.png",
          linkedin: "https://linkedin.com/in/asibong-ephraim-9685b6330"
        },

        ]
    },
    {
        name: "Webmaster Team",
        officers: [
        {
            name: "Adam",
            position: "Webmaster Committee",
            photo: "/officer_photo_blank.png",
            linkedin: "https://linkedin.com"
        }
        ]
    },
    {
        name: "Technical Team",
        officers: [
        {
            name: "Dylan",
            position: "Technical Officer",
            photo: "/officer_photo_blank.png",
            linkedin: "https://linkedin.com"
        }
        ] 
    },
    {
        name: "Project Team",
        officers: [
        {
            name: "Fredy",
            position: "Projects Officer",
            photo: "/officer_photo_blank.png",
            linkedin: "https://linkedin.com"
        }
        ] 
    }
];

const About = () => {
  const [selectedDept, setSelectedDept] = useState(null);

  return (
    <div 
      className="flex flex-col min-h-screen text-white bg-cover bg-center w-full"
      style={{ backgroundImage: "url('/bgphoto.jpg')" }}
    >
      <Navbar />
      <main className="flex-grow px-4 py-8 flex flex-col items-center justify-center w-full max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">About Us</h1>

        {!selectedDept && (
          <>
            <div className="border-8 border-red-700 rounded-xl p-2 w-fit mb-16">
              <img 
                src="/mockAboutPhoto.webp" 
                alt="CougarAI Team" 
                className="w-full h-auto rounded-lg"
              />
            </div>

            <p className="max-w-3xl text-center text-lg mb-16">
              We are your #1 organization at the University of Houston for students wanting
              to learn more about the field of Artificial Intelligence. Anyone and everyone
              is welcome to join. We encourage all to learn about the rapidly evolving field of AI/ML.
            </p>

            <h1 className="text-3xl font-bold mb-16">Our Officers!</h1>

            <section className="bg-red-700 rounded-xl px-16 py-16 w-full max-w-12xl mx-auto text-center mb-16">
              <h3 className="text-white text-xl font-bold mb-8"> SELECT DEPARTMENT</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-16">
                {departments.map((dept, index) => (
                  <button 
                    key={index}
                    className="bg-white hover:bg-gray-200 text-black font-semibold px-8 py-16 rounded shadow transition"
                    onClick={() => setSelectedDept(dept)}
                  >
                    {dept.name}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {selectedDept && (
          <section className="bg-red-700 rounded-xl p-8 max-w-5xl w-full text-center">
            <h2 className="text-2xl font-bold mb-4">{selectedDept.name}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {selectedDept.officers.map((officer, i) => (
                <div key={i} className="bg-gray-100 text-black p-4 rounded shadow">
                  <img 
                    src={officer.photo} 
                    alt={officer.name} 
                    className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
                  />
                  <h3 className="text-xl font-semibold">{officer.name}</h3>
                  <p className="mb-2">{officer.position}</p>
                  <a 
                    href={officer.linkedin} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    LinkedIn
                  </a>
                </div>
              ))}
            </div>

            <button
              className="mt-8 bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-6 rounded"
              onClick={() => setSelectedDept(null)}
            >
              Back to Departments
            </button>
          </section>
        )}

      </main>
      <Footer />
    </div>
  );
};

export default About;