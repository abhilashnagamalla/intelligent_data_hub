import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

export default function Profile() {
  const { user } = useContext(AuthContext);
  // const navigate = useNavigate();

  if (!user) return null;

  const viewedDatasets = JSON.parse(localStorage.getItem('viewed_datasets') || '[]');
  const downloadCounts = JSON.parse(localStorage.getItem('download_counts') || '{}');
  const totalDownloads = Object.values(downloadCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="text-3xl font-black mb-8 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">User Analytics Profile</div>
      <div className="glass p-8 rounded-3xl mb-12 shadow-2xl flex flex-col items-center">
        {user.picture ? (
          <img src={user.picture} alt="Profile" className="w-28 h-28 rounded-full border-4 border-primary/20 shadow-xl mb-6 hover:scale-105 transition-transform object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-28 h-28 rounded-full border-4 border-primary/20 shadow-xl mb-6 flex items-center justify-center bg-gray-200 dark:bg-gray-800 text-4xl font-black">
            {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        )}
        <h2 className="text-3xl font-black text-center mb-2">{user.name}</h2>
        <p className="text-center text-gray-500 font-medium mb-4">{user.email}</p>
        <div className="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-black uppercase tracking-widest">
          Active Researcher
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-8 rounded-2xl border-b-4 border-emerald-500 transform hover:-translate-y-1 transition-all">
          <h3 className="font-black text-xs uppercase tracking-widest text-gray-500 mb-4">Datasets Explored</h3>
          <div className="text-4xl font-black text-emerald-600">{viewedDatasets.length}</div>
        </div>
        <div className="glass p-8 rounded-2xl border-b-4 border-blue-500 transform hover:-translate-y-1 transition-all">
          <h3 className="font-black text-xs uppercase tracking-widest text-gray-500 mb-4">Total Downloads</h3>
          <div className="text-4xl font-black text-blue-600">{totalDownloads}</div>
        </div>
        <div className="glass p-8 rounded-2xl border-b-4 border-indigo-500 transform hover:-translate-y-1 transition-all">
          <h3 className="font-black text-xs uppercase tracking-widest text-gray-500 mb-4">Account Status</h3>
          <div className="text-sm font-bold text-indigo-600 mt-2 uppercase">Fully Synced</div>
        </div>
      </div>
    </div>
  );
}
