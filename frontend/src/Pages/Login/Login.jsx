import React from "react";
import API from "../../axios";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "./Login.css";

const Login = () => {
  const [showPass, setShowPass] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [isReg, setIsReg] = React.useState(true);
  const navigate = useNavigate();

  const [regFormData, setRegFormData] = React.useState({
    name: "",
    email: "",
    password: "",
  });

  const [formData, setFormData] = React.useState({
    email: "",
    password: "",
  });

  function handleToggle() {
    setIsReg(!isReg);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (isReg) {
        res = await API.post("/auth/login", formData);
      } else {
        await API.post("/auth/register", regFormData);
        res = await API.post("/auth/login", regFormData);
      }

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", res.data._id);

      toast.success(`Welcome, ${res.data.name}!`);
      navigate("/home");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Login failed. Please try again."
      );
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="content-wrapper">
        <div className="form-container">
          <div className="form-header">
            <h2>{isReg ? "Welcome Back!" : "Hello!"}</h2>
            <p>
              {isReg
                ? "Login to access Chat Venue"
                : "Register to make an account"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {isReg || (
              <div className="input-group">
                <label>Username</label>
                <input
                  type="text"
                  value={regFormData.name}
                  onChange={(e) =>
                    setRegFormData({ ...regFormData, name: e.target.value })
                  }
                  placeholder="Enter your username"
                  required
                />
              </div>
            )}

            <div className="input-group">
              <label>Email</label>
              <input
                type="email"
                value={isReg ? formData.email : regFormData.email}
                onChange={(e) =>
                  isReg
                    ? setFormData({ ...formData, email: e.target.value })
                    : setRegFormData({
                        ...regFormData,
                        email: e.target.value,
                      })
                }
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="password-input">
                <input
                  type={showPass ? "text" : "password"}
                  value={isReg ? formData.password : regFormData.password}
                  onChange={(e) =>
                    isReg
                      ? setFormData({ ...formData, password: e.target.value })
                      : setRegFormData({
                          ...regFormData,
                          password: e.target.value,
                        })
                  }
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? (
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path
                        fill="currentColor"
                        d="M12 9a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3m0-4.5c5 0 9.27 3.11 11 7.5-1.73 4.39-6 7.5-11 7.5S2.73 16.39 1 12c1.73-4.39 6-7.5 11-7.5M3.18 12a9.821 9.821 0 0 0 17.64 0 9.821 9.821 0 0 0-17.64 0z"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path
                        fill="currentColor"
                        d="M11.83 9L15 12.16V12a3 3 0 0 0-3-3h-.17m-4.3.8l1.55 1.55c-.05.21-.08.42-.08.65a3 3 0 0 0 3 3c.22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53a5 5 0 0 1-5-5c0-.79.2-1.53.53-2.2M2 4.27l2.28 2.28.45.45C3.08 8.3 1.78 10 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.43.42L19.73 22 21 20.73 3.27 3M12 7a5 5 0 0 1 5 5c0 .64-.13 1.26-.36 1.82l2.93 2.93c1.5-1.25 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-4 .7l2.17 2.15C10.74 7.13 11.35 7 12 7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Checking...." : isReg ? "Sign IN" : "Sign Up"}
            </button>

            <p className="toggle-text">
              {isReg ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                onClick={handleToggle}
                className="toggle-link"
              >
                {isReg ? " Register" : " Login"}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
