import smokzyLogo from "@/assets/smokzy-logo.png";

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner = ({ message = "Loading..." }: LoadingSpinnerProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          <img 
            src={smokzyLogo} 
            alt="Smokzy" 
            className="absolute inset-2 w-20 h-20 object-contain animate-pulse"
          />
        </div>
        <p className="text-muted-foreground text-lg">{message}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
