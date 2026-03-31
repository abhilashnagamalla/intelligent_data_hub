import axios from "axios";

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8000" : window.location.origin);

const api = axios.create({
  baseURL,
});

export default api;
