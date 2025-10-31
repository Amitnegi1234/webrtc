import React, { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { FaUser, FaEnvelope, FaLock } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import apiClient from "../../apiClient";
import { useUser } from "../../context/UserContextApi";

const Auth = ({ type }) => {
    const {updateUser}=useUser()
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullname: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "male",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (type === "signup" && formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }
    setLoading(true);
    try {
      const endpoint = type === "signup" ? "/auth/signup" : "/auth/login";
      const response = await apiClient.post(endpoint, formData);
      toast.success(response.data.message || "Success!");
      if (type === "signup") navigate("/login");
      if (type === "login") {
        updateUser(response.data)
        // localStorage.setItem('userData',JSON.stringify(response.data))
        const date = new Date(Date.now() +  24 * 60 * 60 * 1000); // 1day
        const expires = "expires=" + date.toUTCString();
        document.cookie = `jwt=${response.data.token}; path=/; ${expires}`;
        navigate("/");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white px-4">
      <div className="backdrop-blur-md bg-white/10 border border-gray-700 text-white p-8 rounded-2xl shadow-2xl w-full max-w-md transition-all hover:shadow-purple-600/20">
        <h2 className="text-3xl font-bold text-center mb-6">
          {type === "signup" ? "Create Your Account" : "Welcome Back"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {type === "signup" && (
            <>
              <div className="flex items-center bg-gray-800/50 rounded-xl p-3 focus-within:ring-2 ring-purple-500 transition-all">
                <FaUser className="text-purple-400 mr-3" />
                <input
                  type="text"
                  name="fullname"
                  placeholder="Full Name"
                  className="w-full bg-transparent focus:outline-none text-white placeholder-gray-400"
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="flex items-center bg-gray-800/50 rounded-xl p-3 focus-within:ring-2 ring-purple-500 transition-all">
                <FaUser className="text-purple-400 mr-3" />
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  className="w-full bg-transparent focus:outline-none text-white placeholder-gray-400"
                  onChange={handleChange}
                  required
                />
              </div>
            </>
          )}

          <div className="flex items-center bg-gray-800/50 rounded-xl p-3 focus-within:ring-2 ring-purple-500 transition-all">
            <FaEnvelope className="text-purple-400 mr-3" />
            <input
              type="email"
              name="email"
              placeholder="Email"
              className="w-full bg-transparent focus:outline-none text-white placeholder-gray-400"
              onChange={handleChange}
              required
            />
          </div>

          <div className="flex items-center bg-gray-800/50 rounded-xl p-3 focus-within:ring-2 ring-purple-500 transition-all">
            <FaLock className="text-purple-400 mr-3" />
            <input
              type="password"
              name="password"
              placeholder="Password"
              className="w-full bg-transparent focus:outline-none text-white placeholder-gray-400"
              onChange={handleChange}
              required
            />
          </div>

          {type === "signup" && (
            <div className="flex items-center bg-gray-800/50 rounded-xl p-3 focus-within:ring-2 ring-purple-500 transition-all">
              <FaLock className="text-purple-400 mr-3" />
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
                className="w-full bg-transparent focus:outline-none text-white placeholder-gray-400"
                onChange={handleChange}
                required
              />
            </div>
          )}

          {type === "signup" && (
            <div className="flex justify-center space-x-6 text-sm text-gray-300">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={formData.gender === "male"}
                  onChange={handleChange}
                  className="mr-2 accent-purple-500"
                />
                Male
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={formData.gender === "female"}
                  onChange={handleChange}
                  className="mr-2 accent-pink-400"
                />
                Female
              </label>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-purple-600/30"
            disabled={loading}
          >
            {loading ? "Please wait..." : type === "signup" ? "Sign Up" : "Login"}
          </button>
        </form>

        <p className="text-center text-sm mt-6 text-gray-400">
          {type === "signup" ? (
            <>
              Already have an account?{" "}
              <Link to="/login" className="text-purple-400 hover:text-white underline">
                Login
              </Link>
            </>
          ) : (
            <>
              Don’t have an account?{" "}
              <Link to="/signup" className="text-purple-400 hover:text-white underline">
                Register
              </Link>
            </>
          )}
        </p>
      </div>

      <Toaster position="top-center" />
    </div>
  );
};

export default Auth;
