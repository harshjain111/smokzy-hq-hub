interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

const PageLayout = ({ children }: PageLayoutProps) => {
  // AppShell now provides the navigation shell, header, and sidebar.
  // PageLayout is kept as a simple pass-through for backward compatibility.
  return <>{children}</>;
};

export default PageLayout;
