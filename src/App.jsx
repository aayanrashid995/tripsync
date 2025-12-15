import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, query, where, 
  onSnapshot, doc, updateDoc, deleteDoc, getDocs, arrayUnion
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Plane, Calendar, CreditCard, MessageCircle, MapPin, 
  Users, Plus, LogOut, Share2, DollarSign, Check, 
  Clock, Trash2, ChevronLeft, Send, Home, Hotel,
  X, AlertCircle, Sparkles, Pencil, MoreVertical, 
  Camera, FileText, ThumbsUp, MessageSquare, ExternalLink
} from 'lucide-react';

/**
 * ------------------------------------------------------------------
 * 1. CONFIGURATION & ENVIRONMENT HELPERS
 * ------------------------------------------------------------------
 */

const USE_FIREBASE = true; 

// Robust helper to safely get Env Vars without crashing the build
const getEnv = (key) => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key] || '';
    }
  } catch (e) {
    console.warn('Environment variable access failed:', e);
  }
  return '';
};

// FIREBASE INIT
const FIREBASE_CONFIG = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

let db, auth, storage;
if (USE_FIREBASE) {
  try {
    const app = !getApps().length ? initializeApp(FIREBASE_CONFIG) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
  } catch (error) {
    console.warn("Firebase initialized in mock mode (Build step).");
  }
}

/**
 * ------------------------------------------------------------------
 * 2. ROBUST SERVICES (Booking.com & Gemini AI)
 * ------------------------------------------------------------------
 */

// MOCK DATA GENERATOR (Used as Failsafe)
const getMockHotels = (locationName) => {
  const isThai = locationName.toLowerCase().includes('thai') || locationName.toLowerCase().includes('bangkok');
  if (isThai) {
    return [
      { id: 101, name: "Grand Hyatt Erawan Bangkok", price: "180", rating: 9.1, image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80", url: "#", amenities: "Pool, Spa" },
      { id: 102, name: "Sala Rattanakosin", price: "120", rating: 8.8, image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80", url: "#", amenities: "River View" },
      { id: 103, name: "The Siam Hotel", price: "250", rating: 9.5, image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80", url: "#", amenities: "Luxury" },
    ];
  }
  return [
    { id: 1, name: `Grand Plaza ${locationName}`, price: "150", rating: 8.5, image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80", url: "#" },
    { id: 2, name: `${locationName} City Inn`, price: "95", rating: 7.9, image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80", url: "#" },
    { id: 3, name: "Sunset Resort", price: "210", rating: 9.2, image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80", url: "#" },
  ];
};

const BookingService = {
  apiKey: getEnv('VITE_RAPIDAPI_KEY'), 
  host: "booking-com.p.rapidapi.com",

  async searchHotels(locationName) {
    // 1. FAILSAFE: If no key, return mock data immediately
    if (!this.apiKey) {
      console.warn("⚠️ No Booking API Key. Returning Mock Data.");
      await new Promise(r => setTimeout(r, 800)); // Fake loading
      return getMockHotels(locationName);
    }

    try {
      console.log(`🔎 Searching Location ID for: ${locationName}`);
      
      // Step A: Get Location ID
      const locationResp = await fetch(`https://${this.host}/v1/hotels/locations?name=${locationName}&locale=en-gb`, {
        method: 'GET',
        headers: { 'X-RapidAPI-Key': this.apiKey, 'X-RapidAPI-Host': this.host }
      });

      if (!locationResp.ok) throw new Error(`Location API Error: ${locationResp.status}`);
      const locData = await locationResp.json();
      
      if (!locData || locData.length === 0) throw new Error("Location not found");

      const destId = locData[0].dest_id;
      const searchType = locData[0].dest_type;

      // Step B: Get Hotels
      console.log(`🏨 Searching Hotels for ID: ${destId}`);
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const searchResp = await fetch(`https://${this.host}/v1/hotels/search?dest_id=${destId}&search_type=${searchType}&arrival_date=${today}&departure_date=${nextWeek}&adults_number=2&room_number=1&units=metric&order_by=popularity&filter_by_currency=USD&locale=en-gb`, {
        method: 'GET',
        headers: { 'X-RapidAPI-Key': this.apiKey, 'X-RapidAPI-Host': this.host }
      });

      if (!searchResp.ok) throw new Error(`Search API Error: ${searchResp.status}`);
      const searchData = await searchResp.json();
      
      if (!searchData.result) return getMockHotels(locationName); // Fallback if empty

      // Transform Real Data
      return searchData.result.map(h => ({
        id: h.hotel_id,
        name: h.hotel_name,
        price: h.composite_price_breakdown?.gross_amount?.value?.toFixed(0) || "Check Price",
        rating: h.review_score || "N/A",
        image: h.max_photo_url || "https://via.placeholder.com/300",
        url: h.url,
        amenities: "Free Wifi"
      }));

    } catch (error) {
      // 2. FAILSAFE: If API crashes (403, 429, etc), return mock data
      console.error("⚠️ Real API Failed (Using Fallback):", error);
      return getMockHotels(locationName);
    }
  }
};

const GeminiService = {
  async generateItinerary(destination, days = 3) {
    const apiKey = getEnv('VITE_GEMINI_API_KEY'); 
    
    if (!apiKey) {
        console.warn("Gemini API Key missing");
        return [];
    }

    // Strict JSON prompt
    const systemPrompt = `You are a travel assistant. Create a fun, realistic ${days}-day itinerary for ${destination}. 
    Return strictly a JSON array of objects. Do not wrap in markdown code blocks. Each object must have: 
    - "title" (short activity name)
    - "time" (e.g. "10:00 AM")
    - "description" (one sentence detail)
    - "day" (number 1 to ${days})
    Generate about 2-3 activities per day.`;

    try {
      // FIX: Using Stable Model 'gemini-1.5-flash' to prevent 403 errors
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
      });
      
      if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);

      const data = await response.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      
      // Sanitizing response to ensure valid JSON
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(text);
    } catch (error) {
      console.error("Gemini Error:", error);
      throw new Error("Failed to generate itinerary. Check API Key.");
    }
  },

  async summarizeChat(messages) {
    const apiKey = getEnv('VITE_GEMINI_API_KEY'); 
    if (messages.length === 0) return "No messages to summarize.";
    if (!apiKey) return "AI Summary unavailable (Key missing)";

    const chatLog = messages.map(m => `${m.senderName}: ${m.text}`).join("\n");
    const prompt = `Summarize the following group chat travel plans and key decisions in 3 bullet points:\n\n${chatLog}`;

    try {
      // FIX: Using Stable Model 'gemini-1.5-flash'
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      console.error("Gemini Summary Error:", error);
      return "Unable to summarize at this time.";
    }
  }
};

const StorageService = {
  // --- AUTH ---
  async login(email, password) {
    if (USE_FIREBASE && auth) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { uid: userCredential.user.uid, email, name: userCredential.user.displayName || email.split('@')[0] };
    } else {
      const users = JSON.parse(localStorage.getItem('ts_users') || '[]');
      const user = users.find(u => u.email === email && u.password === password);
      if (!user) throw new Error("Invalid credentials");
      return user;
    }
  },

  async loginWithGoogle() {
    if (USE_FIREBASE && auth) {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      return { 
        uid: user.uid, 
        email: user.email, 
        name: user.displayName || user.email.split('@')[0] 
      };
    } else {
      throw new Error("Google Login requires Firebase to be enabled.");
    }
  },

  async signup(name, email, password) {
    if (USE_FIREBASE && auth) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return { uid: userCredential.user.uid, email, name };
    } else {
      const users = JSON.parse(localStorage.getItem('ts_users') || '[]');
      if (users.find(u => u.email === email)) throw new Error("Email already exists");
      const newUser = { uid: 'user_' + Date.now(), name, email, password };
      users.push(newUser);
      localStorage.setItem('ts_users', JSON.stringify(users));
      return newUser;
    }
  },

  // --- FILE UPLOAD ---
  async uploadFile(file) {
    if (USE_FIREBASE && storage) {
      const storageRef = ref(storage, `receipts/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } else {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result); 
        reader.readAsDataURL(file);
      });
    }
  },

  // --- TRIPS ---
  subscribeToTrips(userId, callback) {
    if (USE_FIREBASE && db) {
      const q = query(collection(db, "trips"), where("members", "array-contains", userId));
      return onSnapshot(q, (snapshot) => {
        const trips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(trips);
      });
    } else {
      const checkLocal = () => {
        const trips = JSON.parse(localStorage.getItem('ts_trips') || '[]');
        const userTrips = trips.filter(t => t.members.includes(userId));
        callback(userTrips);
      };
      checkLocal();
      const interval = setInterval(checkLocal, 2000);
      return () => clearInterval(interval);
    }
  },

  async createTrip(tripData) {
    if (USE_FIREBASE && db) return await addDoc(collection(db, "trips"), tripData);
    const trips = JSON.parse(localStorage.getItem('ts_trips') || '[]');
    const newTrip = { id: 'trip_' + Date.now(), ...tripData };
    trips.push(newTrip);
    localStorage.setItem('ts_trips', JSON.stringify(trips));
    return newTrip;
  },

  async joinTrip(code, userId) {
    if (USE_FIREBASE && db) {
      const q = query(collection(db, "trips"), where("code", "==", code));
      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error("Invalid Trip Code");
      const tripDoc = snapshot.docs[0];
      const tripData = tripDoc.data();
      if (tripData.members.includes(userId)) throw new Error("Already joined");
      await updateDoc(doc(db, "trips", tripDoc.id), { members: arrayUnion(userId) });
      return tripDoc.id;
    } else {
      const trips = JSON.parse(localStorage.getItem('ts_trips') || '[]');
      const tripIndex = trips.findIndex(t => t.code === code);
      if (tripIndex === -1) throw new Error("Invalid Trip Code");
      if (trips[tripIndex].members.includes(userId)) throw new Error("Already joined");
      trips[tripIndex].members.push(userId);
      localStorage.setItem('ts_trips', JSON.stringify(trips));
      return trips[tripIndex].id;
    }
  },

  // --- GENERIC CRUD ---
  subscribeToSubCollection(collectionName, tripId, callback) {
    if (USE_FIREBASE && db) {
      const q = query(collection(db, collectionName), where("tripId", "==", tripId));
      return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(items);
      });
    } else {
      const checkLocal = () => {
        const allItems = JSON.parse(localStorage.getItem(`ts_${collectionName}`) || '[]');
        const tripItems = allItems.filter(i => i.tripId === tripId);
        callback(tripItems);
      };
      checkLocal();
      const interval = setInterval(checkLocal, 1000);
      return () => clearInterval(interval);
    }
  },

  async addItem(collectionName, itemData) {
    if (USE_FIREBASE && db) {
      await addDoc(collection(db, collectionName), { ...itemData, createdAt: new Date().toISOString() });
    } else {
      const allItems = JSON.parse(localStorage.getItem(`ts_${collectionName}`) || '[]');
      allItems.push({ id: `${collectionName}_${Date.now()}`, ...itemData, createdAt: new Date().toISOString() });
      localStorage.setItem(`ts_${collectionName}`, JSON.stringify(allItems));
    }
  },

  async deleteItem(collectionName, itemId) {
    if (USE_FIREBASE && db) {
      await deleteDoc(doc(db, collectionName, itemId));
    } else {
      let allItems = JSON.parse(localStorage.getItem(`ts_${collectionName}`) || '[]');
      allItems = allItems.filter(i => i.id !== itemId);
      localStorage.setItem(`ts_${collectionName}`, JSON.stringify(allItems));
    }
  },

  // --- COMMENTS & VOTES ---
  async addCommentToActivity(activityId, comment) {
    if (USE_FIREBASE && db) {
      await updateDoc(doc(db, "itinerary", activityId), { comments: arrayUnion(comment) });
    } else {
      const items = JSON.parse(localStorage.getItem('ts_itinerary') || '[]');
      const index = items.findIndex(i => i.id === activityId);
      if(index !== -1) {
        items[index].comments = items[index].comments || [];
        items[index].comments.push(comment);
        localStorage.setItem('ts_itinerary', JSON.stringify(items));
      }
    }
  },

  async toggleVote(activityId, userId) {
    if (USE_FIREBASE && db) {
      await updateDoc(doc(db, "itinerary", activityId), { votes: arrayUnion(userId) });
    } else {
      const items = JSON.parse(localStorage.getItem('ts_itinerary') || '[]');
      const index = items.findIndex(i => i.id === activityId);
      if(index !== -1) {
        items[index].votes = items[index].votes || [];
        if (!items[index].votes.includes(userId)) items[index].votes.push(userId);
        localStorage.setItem('ts_itinerary', JSON.stringify(items));
      }
    }
  },

  async updateItem(collectionName, itemId, data) {
    if (USE_FIREBASE && db) {
      await updateDoc(doc(db, collectionName, itemId), data);
    } else {
      const allItems = JSON.parse(localStorage.getItem(`ts_${collectionName}`) || '[]');
      const index = allItems.findIndex(i => i.id === itemId);
      if (index !== -1) {
        allItems[index] = { ...allItems[index], ...data };
        localStorage.setItem(`ts_${collectionName}`, JSON.stringify(allItems));
      }
    }
  }
};

// ... (Components) ...
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === 'error' ? 'bg-red-500' : 'bg-green-500';
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-full text-white shadow-xl flex items-center gap-2 animate-bounce-in ${bg}`}>
      {type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
      <span className="font-medium text-sm">{message}</span>
    </div>
  );
};

const LoadingSpinner = () => <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />;

// --- MAIN APP ---

const TripSyncUltimate = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('welcome');
  const [activeTrip, setActiveTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('ts_active_user');
    if (savedUser) { setUser(JSON.parse(savedUser)); setView('dashboard'); }
  }, []);

  const showToast = (message, type = 'success') => setToast({ message, type });

  // ... (AuthScreen) ...
  const AuthScreen = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });

    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
        const userData = await (isLogin ? StorageService.login(formData.email, formData.password) : StorageService.signup(formData.name, formData.email, formData.password));
        setUser(userData);
        localStorage.setItem('ts_active_user', JSON.stringify(userData));
        setView('dashboard');
      } catch (err) { showToast(err.message, 'error'); } 
      finally { setLoading(false); }
    };

    const handleGoogleLogin = async () => {
      setLoading(true);
      try {
        const userData = await StorageService.loginWithGoogle();
        setUser(userData);
        localStorage.setItem('ts_active_user', JSON.stringify(userData));
        setView('dashboard');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600"><Plane size={32} /></div>
            <h1 className="text-3xl font-bold text-gray-900">TripSync</h1>
            <p className="text-gray-500 mt-2">Group travel made simple</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && <div className="relative"><Users className="absolute left-4 top-3.5 text-gray-400" size={20} /><input type="text" placeholder="Full Name" className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required={!isLogin} /></div>}
            <div className="relative"><MessageCircle className="absolute left-4 top-3.5 text-gray-400" size={20} /><input type="email" placeholder="Email" className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></div>
            <div className="relative"><Calendar className="absolute left-4 top-3.5 text-gray-400" size={20} /><input type="password" placeholder="Password" className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required /></div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">{loading ? <LoadingSpinner /> : (isLogin ? 'Sign In' : 'Create Account')}</button>
          </form>
          
          <button 
            type="button"
            onClick={handleGoogleLogin} 
            className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-4 hover:bg-gray-50 shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>

          <p className="text-center mt-6 text-sm"><button onClick={() => setIsLogin(!isLogin)} className="text-blue-600 font-bold hover:underline">{isLogin ? 'Create an account' : 'Back to Login'}</button></p>
        </div>
      </div>
    );
  };

  const Dashboard = () => {
    const [trips, setTrips] = useState([]);
    const [modal, setModal] = useState(null); 
    const [formData, setFormData] = useState({ title: '', destination: '', startDate: '', endDate: '', joinCode: '' });

    useEffect(() => { if (user) return StorageService.subscribeToTrips(user.uid, setTrips); }, [user]);

    const handleCreate = async () => {
      setLoading(true);
      try {
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        const days = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
        await StorageService.createTrip({ 
          ...formData, days, code: Math.random().toString(36).substring(2, 8).toUpperCase(), 
          organizer: user.uid, members: [user.uid] 
        });
        showToast('Trip created!');
        setModal(null);
      } catch (e) { showToast(e.message, 'error'); } finally { setLoading(false); }
    };

    const handleJoin = async () => {
      setLoading(true);
      try {
        await StorageService.joinTrip(formData.joinCode, user.uid);
        showToast('Joined trip!');
        setModal(null);
      } catch (e) { showToast(e.message, 'error'); } finally { setLoading(false); }
    };

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white px-6 pt-12 pb-6 shadow-sm sticky top-0 z-20">
          <div className="flex justify-between items-center mb-6">
            <div><h1 className="text-2xl font-black text-gray-900">Dashboard</h1><p className="text-gray-500">Hello, {user?.name}</p></div>
            <button onClick={() => { localStorage.removeItem('ts_active_user'); setUser(null); setView('welcome'); }} className="p-2 bg-gray-100 rounded-full hover:text-red-600"><LogOut size={20} /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setModal('create')} className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg flex flex-col items-center gap-2 hover:scale-[1.02] transition"><Plus size={24} /><span className="font-bold">New Trip</span></button>
            <button onClick={() => setModal('join')} className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg flex flex-col items-center gap-2 hover:scale-[1.02] transition"><Users size={24} /><span className="font-bold">Join Trip</span></button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg">Your Trips</h2>
          {trips.length === 0 ? <div className="text-center py-10 text-gray-400"><Plane size={48} className="mx-auto mb-4 opacity-20" /><p>No trips yet.</p></div> : 
            trips.map(trip => (
              <div key={trip.id} onClick={() => { setActiveTrip(trip); setView('trip'); }} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer">
                <div className="flex justify-between mb-3"><div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center"><MapPin size={20} /></div><span className="bg-gray-100 text-xs font-bold px-3 py-1 rounded-full h-fit">{trip.members.length} Members</span></div>
                <h3 className="text-xl font-bold mb-1">{trip.title}</h3>
                <div className="text-gray-500 text-sm flex items-center gap-2"><Calendar size={14} /> {trip.startDate} - {trip.endDate}</div>
              </div>
            ))
          }
        </div>

        {modal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4">
              <h3 className="text-xl font-bold">{modal === 'create' ? 'Create Trip' : 'Join Trip'}</h3>
              {modal === 'create' ? (
                <>
                  <input className="w-full p-3 bg-gray-50 rounded-xl outline-none" placeholder="Trip Name" onChange={e => setFormData({...formData, title: e.target.value})} />
                  <input className="w-full p-3 bg-gray-50 rounded-xl outline-none" placeholder="Destination" onChange={e => setFormData({...formData, destination: e.target.value})} />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" className="w-full p-3 bg-gray-50 rounded-xl" onChange={e => setFormData({...formData, startDate: e.target.value})} />
                    <input type="date" className="w-full p-3 bg-gray-50 rounded-xl" onChange={e => setFormData({...formData, endDate: e.target.value})} />
                  </div>
                </>
              ) : (
                <input className="w-full p-3 bg-gray-50 rounded-xl text-center text-2xl tracking-widest uppercase font-mono" placeholder="CODE" maxLength={6} onChange={e => setFormData({...formData, joinCode: e.target.value.toUpperCase()})} />
              )}
              <div className="flex gap-2">
                <button onClick={() => setModal(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl">Cancel</button>
                <button onClick={modal === 'create' ? handleCreate : handleJoin} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl">{loading ? <LoadingSpinner /> : (modal === 'create' ? 'Create' : 'Join')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- TRIP VIEW ---
  const TripView = () => {
    const [tab, setTab] = useState('overview');
    const [expenses, setExpenses] = useState([]);
    const [messages, setMessages] = useState([]);
    const [itinerary, setItinerary] = useState([]);
    
    // Sub-view States
    const [expenseModal, setExpenseModal] = useState(false);
    const [activityModal, setActivityModal] = useState(false);
    const [newExpense, setNewExpense] = useState({ title: '', amount: '', paidBy: user.uid, splitWith: activeTrip.members, receipt: null });
    const [newActivity, setNewActivity] = useState({ title: '', time: '10:00', description: '', day: 1 });
    const [hotels, setHotels] = useState([]);
    const [loadingHotel, setLoadingHotel] = useState(false);
    const [expandedActivity, setExpandedActivity] = useState(null);
    const [commentText, setCommentText] = useState('');

    useEffect(() => {
      const unsub1 = StorageService.subscribeToSubCollection("expenses", activeTrip.id, setExpenses);
      const unsub2 = StorageService.subscribeToSubCollection("messages", activeTrip.id, (d) => setMessages(d.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt))));
      const unsub3 = StorageService.subscribeToSubCollection("itinerary", activeTrip.id, (d) => setItinerary(d.sort((a,b) => a.day - b.day || a.time.localeCompare(b.time))));
      return () => { unsub1(); unsub2(); unsub3(); };
    }, []);

    // --- ACTIONS ---
    const handleAddExpense = async () => {
      setLoading(true);
      try {
        let receiptUrl = null;
        if (newExpense.receipt) {
          receiptUrl = await StorageService.uploadFile(newExpense.receipt);
        }
        await StorageService.addItem("expenses", {
          tripId: activeTrip.id,
          title: newExpense.title,
          amount: parseFloat(newExpense.amount),
          paidBy: newExpense.paidBy,
          splitWith: newExpense.splitWith, 
          receiptUrl
        });
        showToast('Expense added');
        setExpenseModal(false);
      } catch (e) { showToast(e.message, 'error'); } finally { setLoading(false); }
    };

    const handleVote = async (id) => {
      await StorageService.toggleVote(id, user.uid);
    };

    const handleComment = async (id) => {
      if(!commentText.trim()) return;
      await StorageService.addCommentToActivity(id, { user: user.name, text: commentText, time: new Date().toISOString() });
      setCommentText('');
    };

    const handleFindHotels = async () => {
      setLoadingHotel(true);
      try {
        const res = await BookingService.searchHotels(activeTrip.destination);
        setHotels(res);
      } catch (e) {
        showToast("Could not fetch hotels", "error");
      } finally {
        setLoadingHotel(false);
      }
    };

    // ... (TimelineTab, ExpensesTab remain mostly same) ...
    const TimelineTab = () => (
      <div className="p-4 space-y-4 pb-24 h-[calc(100vh-140px)] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">Itinerary</h2>
          <button onClick={() => setActivityModal(true)} className="bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"><Plus size={16}/> Add</button>
        </div>
        
        {itinerary.length === 0 ? (
          <div className="text-center py-10">
            <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No plans yet.</p>
            <button onClick={async () => {
              setLoading(true);
              const items = await GeminiService.generateItinerary(activeTrip.destination, activeTrip.days || 3);
              items.forEach(i => StorageService.addItem("itinerary", { ...i, tripId: activeTrip.id, votes: [], comments: [] }));
              setLoading(false);
            }} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg">{loading ? <LoadingSpinner/> : 'Auto-Generate with AI'}</button>
          </div>
        ) : (
          itinerary.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 flex gap-4 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedActivity(expandedActivity === item.id ? null : item.id)}>
                <div className="bg-blue-50 text-blue-600 w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold uppercase">Day</span>
                  <span className="text-lg font-black">{item.day}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-gray-900">{item.title}</h3>
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{item.time}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                  
                  <div className="flex gap-4 mt-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><ThumbsUp size={12} /> {item.votes?.length || 0}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={12} /> {item.comments?.length || 0}</span>
                  </div>
                </div>
              </div>

              {expandedActivity === item.id && (
                <div className="bg-gray-50 p-4 border-t border-gray-100">
                  <div className="flex gap-2 mb-4">
                    <button onClick={(e) => { e.stopPropagation(); handleVote(item.id); }} className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition ${item.votes?.includes(user.uid) ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                      <ThumbsUp size={16} /> Vote
                    </button>
                    <button onClick={async () => { if(window.confirm('Delete?')) await StorageService.deleteItem("itinerary", item.id); }} className="p-2 text-red-500 bg-white border border-red-100 rounded-lg"><Trash2 size={18} /></button>
                  </div>

                  <div className="space-y-3 mb-3">
                    {item.comments?.map((c, idx) => (
                      <div key={idx} className="text-sm bg-white p-2 rounded-lg border border-gray-100">
                        <span className="font-bold text-gray-800">{c.user}: </span>
                        <span className="text-gray-600">{c.text}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <input className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="Add comment..." value={commentText} onChange={e => setCommentText(e.target.value)} />
                    <button onClick={() => handleComment(item.id)} className="bg-blue-600 text-white p-2 rounded-lg"><Send size={16}/></button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    );

    const ExpensesTab = () => {
      const balances = useMemo(() => {
        const bal = {};
        activeTrip.members.forEach(m => bal[m] = 0);
        expenses.forEach(e => {
          const splitCount = e.splitWith ? e.splitWith.length : activeTrip.members.length;
          const share = e.amount / splitCount;
          
          if (e.splitWith) {
            e.splitWith.forEach(memberId => {
              if (memberId !== e.paidBy) bal[memberId] -= share;
            });
            if (e.splitWith.includes(e.paidBy)) {
               bal[e.paidBy] += (e.amount - share);
            } else {
               bal[e.paidBy] += e.amount;
            }
          } else {
             activeTrip.members.forEach(m => {
               if(m !== e.paidBy) bal[m] -= share;
               else bal[e.paidBy] += (e.amount - share);
             });
          }
        });
        return bal;
      }, [expenses]);

      return (
        <div className="p-4 space-y-4 pb-24 h-[calc(100vh-140px)] overflow-y-auto">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-3xl p-6 text-white shadow-lg">
            <div className="text-sm opacity-80 mb-1">Your Balance</div>
            <div className="text-4xl font-black mb-4">
              {balances[user.uid] >= 0 ? '+' : ''}${balances[user.uid]?.toFixed(2) || '0.00'}
            </div>
            {balances[user.uid] < -0.01 && (
              <button onClick={() => showToast("Feature coming: Integrate Stripe/PayPal to settle instantly!")} className="w-full py-3 bg-white/20 backdrop-blur rounded-xl font-bold hover:bg-white/30 transition">
                Pay Your Share
              </button>
            )}
          </div>

          <div className="space-y-3">
            {expenses.map(exp => (
              <div key={exp.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center flex-shrink-0"><DollarSign size={20} /></div>
                  <div className="overflow-hidden">
                    <div className="font-bold text-gray-900 truncate">{exp.title}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      {exp.receiptUrl && <FileText size={10} className="text-blue-500"/>}
                      Paid by {exp.paidBy === user.uid ? 'You' : 'Member'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg text-gray-900">${exp.amount}</div>
                  {exp.receiptUrl && <a href={exp.receiptUrl} target="_blank" className="text-xs text-blue-600 underline">View Receipt</a>}
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setExpenseModal(true)} className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition"><Plus size={28} /></button>
        </div>
      );
    };

    const HotelsTab = () => (
      <div className="p-4 space-y-4 pb-24 h-[calc(100vh-140px)] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">Hotels in {activeTrip.destination}</h2>
          <button onClick={handleFindHotels} disabled={loadingHotel} className="bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg text-sm font-bold">
            {loadingHotel ? <LoadingSpinner/> : 'Refresh'}
          </button>
        </div>

        {hotels.length === 0 && !loadingHotel && (
          <div className="text-center py-10">
            <Hotel className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Tap refresh to find hotels.</p>
            <button onClick={handleFindHotels} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">Find Hotels</button>
          </div>
        )}

        {hotels.map((h, i) => (
          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="h-32 bg-gray-200 relative">
              <img src={h.image} alt={h.name} className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded text-xs font-bold shadow">⭐ {h.rating}</div>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-gray-900">{h.name}</h3>
                <span className="text-green-600 font-bold">${h.price}</span>
              </div>
              <a href={h.url} target="_blank" rel="noopener noreferrer" className="w-full block text-center py-2 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 transition flex items-center justify-center gap-2">
                View on Booking.com <ExternalLink size={14}/>
              </a>
            </div>
          </div>
        ))}
      </div>
    );

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100 p-4 sticky top-0 z-10 flex items-center justify-between">
          <button onClick={() => setView('dashboard')} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={24} className="text-gray-700" /></button>
          <div className="font-bold text-gray-900">{activeTrip.title}</div>
          <button className="p-2 text-gray-400"><MoreVertical size={24}/></button>
        </div>

        {tab === 'timeline' && <TimelineTab />}
        {tab === 'expenses' && <ExpensesTab />}
        {tab === 'hotels' && <HotelsTab />}
        {tab === 'chat' && <div className="p-4 text-center text-gray-500 mt-10">Chat feature coming soon</div>}

        {/* BOTTOM NAV */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center z-40 pb-safe">
          <button onClick={() => setTab('timeline')} className={`flex flex-col items-center gap-1 ${tab === 'timeline' ? 'text-blue-600' : 'text-gray-400'}`}><Clock size={24} /><span className="text-[10px] font-bold">Plan</span></button>
          <button onClick={() => setTab('expenses')} className={`flex flex-col items-center gap-1 ${tab === 'expenses' ? 'text-blue-600' : 'text-gray-400'}`}><CreditCard size={24} /><span className="text-[10px] font-bold">Money</span></button>
          <button onClick={() => setTab('hotels')} className={`flex flex-col items-center gap-1 ${tab === 'hotels' ? 'text-blue-600' : 'text-gray-400'}`}><Hotel size={24} /><span className="text-[10px] font-bold">Hotels</span></button>
          <button onClick={() => setTab('chat')} className={`flex flex-col items-center gap-1 ${tab === 'chat' ? 'text-blue-600' : 'text-gray-400'}`}><MessageCircle size={24} /><span className="text-[10px] font-bold">Chat</span></button>
        </div>

        {/* --- MODALS --- */}
        {expenseModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 animate-slide-up space-y-4">
              <h3 className="text-xl font-bold">Add Expense</h3>
              <input className="w-full p-3 bg-gray-50 rounded-xl" placeholder="Title" onChange={e => setNewExpense({...newExpense, title: e.target.value})} />
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500">$</span>
                <input type="number" className="w-full p-3 pl-7 bg-gray-50 rounded-xl" placeholder="0.00" onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
              </div>
              
              <label className="flex items-center gap-2 p-3 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50">
                <Camera size={20} className="text-gray-400" />
                <span className="text-sm text-gray-600">{newExpense.receipt ? 'Receipt Selected' : 'Upload Receipt'}</span>
                <input type="file" className="hidden" onChange={e => setNewExpense({...newExpense, receipt: e.target.files[0]})} />
              </label>

              <div className="text-sm">
                <p className="font-bold mb-2">Split With:</p>
                <div className="flex flex-wrap gap-2">
                  {activeTrip.members.map(m => (
                    <button key={m} onClick={() => {
                      const current = newExpense.splitWith || activeTrip.members;
                      const updated = current.includes(m) ? current.filter(id => id !== m) : [...current, m];
                      setNewExpense({...newExpense, splitWith: updated});
                    }} className={`px-3 py-1 rounded-full text-xs font-bold transition ${newExpense.splitWith?.includes(m) ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                      {m === user.uid ? 'Me' : `User ${m.slice(0,3)}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setExpenseModal(false)} className="flex-1 py-3 text-gray-500 font-bold">Cancel</button>
                <button onClick={handleAddExpense} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl">{loading ? <LoadingSpinner/> : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        {activityModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 animate-slide-up space-y-4">
              <h3 className="text-xl font-bold">Add Activity</h3>
              <input className="w-full p-3 bg-gray-50 rounded-xl" placeholder="Title" onChange={e => setNewActivity({...newActivity, title: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input type="time" className="w-full p-3 bg-gray-50 rounded-xl" value={newActivity.time} onChange={e => setNewActivity({...newActivity, time: e.target.value})} />
                <select className="w-full p-3 bg-gray-50 rounded-xl" onChange={e => setNewActivity({...newActivity, day: parseInt(e.target.value)})}>
                  {Array.from({length: activeTrip.days || 3}, (_, i) => <option key={i} value={i+1}>Day {i+1}</option>)}
                </select>
              </div>
              <textarea className="w-full p-3 bg-gray-50 rounded-xl" placeholder="Details..." onChange={e => setNewActivity({...newActivity, description: e.target.value})} />
              <div className="flex gap-2">
                <button onClick={() => setActivityModal(false)} className="flex-1 py-3 text-gray-500 font-bold">Cancel</button>
                <button onClick={async () => {
                  await StorageService.addItem("itinerary", { ...newActivity, tripId: activeTrip.id, votes: [], comments: [] });
                  setActivityModal(false);
                }} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="font-sans text-gray-900 antialiased selection:bg-blue-200">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {view === 'welcome' && <AuthScreen />}
      {view === 'dashboard' && <Dashboard />}
      {view === 'trip' && <TripView />}
    </div>
  );
};

export default TripSyncUltimate;
