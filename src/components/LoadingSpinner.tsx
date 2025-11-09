import smokzyLogo from "@/assets/smokzy-logo.png";

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner = ({ message = "Loading..." }: LoadingSpinnerProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-32 h-32 mx-auto mb-6 relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-auth-gold/30 to-auth-accent/20 blur-2xl animate-pulse"></div>
          <img 
            src={smokzyLogo} 
            alt="Smokzy" 
            className="w-full h-full object-contain animate-spin relative z-10"
            style={{ 
              animationDuration: '3s',
              filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.4))'
            }}
          />
        </div>
        <p className="text-muted-foreground text-lg">{message}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
