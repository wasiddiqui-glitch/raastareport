function Navbar({ currentUser, onLoginClick, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">RaastaReport</div>
      <div className="navbar-links">
        <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Home</a>
        <a href="#reports">Reports</a>
        <a href="#report-form">Report Hazard</a>
        {currentUser ? (
          <div className="navbar-user">
            <span className="navbar-username">👤 {currentUser.name}</span>
            <button className="navbar-logout-btn" onClick={onLogout}>Log Out</button>
          </div>
        ) : (
          <button className="navbar-login-btn" onClick={onLoginClick}>Log In</button>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
