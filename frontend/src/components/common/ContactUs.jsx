import { Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const teamMembers = [
  { name: 'Abhilash', email: 'abhilashnagamalla35@gmail.com' },
  { name: 'BeranTeja', email: 'berantejakolluri@gmail.com' },
  { name: 'Jayanth', email: 'battujayanth2456@gmail.com' },
];

export default function ContactUs({ collapsed }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredEmail, setHoveredEmail] = useState(null);

  const handleEmailClick = (email, name) => {
    const subject = 'Inquiry about Intelligent Data Hub';
    const body = `Hello ${name},\n\nI would like to reach out regarding the Intelligent Data Hub project.\n\nBest regards`;
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  return (
    <div className="border-t-2 border-black p-2 sm:p-3 mt-auto space-y-1">
      {/* Suggestion/Feedback Text */}
      {!collapsed && (
        <div className="text-xs text-gray-500 px-2 py-1">
          Have suggestions or feedback? <span className="text-blue-400">Let us know</span> below.
        </div>
      )}

      {/* Dropdown Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 rounded-lg p-2 hover:bg-white/10 transition-colors group"
      >
        <Mail className="w-3.5 sm:w-4 h-3.5 sm:h-4 flex-shrink-0 text-gray-400 group-hover:text-blue-400 transition-colors" />
        {!collapsed && (
          <>
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Contact Us
            </span>
            <div className="ml-auto">
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              )}
            </div>
          </>
        )}
      </button>

      {/* Dropdown Content */}
      {isExpanded && !collapsed && (
        <div className="space-y-1 mt-2 pl-1">
          {teamMembers.map((member) => (
            <button
              key={member.email}
              onClick={() => handleEmailClick(member.email, member.name)}
              onMouseEnter={() => setHoveredEmail(member.email)}
              onMouseLeave={() => setHoveredEmail(null)}
              className="w-full flex items-center gap-2 rounded-lg border-2 border-transparent p-1.5 sm:p-2 hover:bg-white/10 hover:border-white/40 transition-all group text-left"
              title={`Email ${member.name}`}
            >
              <Mail className="w-3 sm:w-3.5 h-3 sm:h-3.5 flex-shrink-0 text-gray-500 group-hover:text-blue-400 transition-colors" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-300 truncate">
                  {member.name}
                </div>
                <div className="text-xs text-gray-500 truncate group-hover:text-blue-300 transition-colors">
                  {hoveredEmail === member.email ? member.email : member.email.split('@')[0]}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
