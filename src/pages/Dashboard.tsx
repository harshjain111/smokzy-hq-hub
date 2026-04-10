// This file is kept for backward compatibility but is no longer the main entry point.
// All routing now goes through AuthenticatedApp → AppShell.
import { Navigate } from "react-router-dom";

const Dashboard = () => <Navigate to="/dashboard" replace />;
export default Dashboard;
