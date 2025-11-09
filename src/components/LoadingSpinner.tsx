import smokzyLogo from "@/assets/smokzy-logo.png";

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner = ({ message = "Loading..." }: LoadingSpinnerProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-32 h-32 mx-auto mb-6">
          <img 
            src={smokzyLogo} 
            alt="Smokzy" 
            className="w-full h-full object-contain animate-spin"
            style={{ animationDuration: '3s' }}
          />
        </div>
        <p className="text-muted-foreground text-lg">{message}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
