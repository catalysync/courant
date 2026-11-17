import { AlertTriangleIcon } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  description?: string;
}

export const ErrorState = ({ title = "Something went wrong", description }: ErrorStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <AlertTriangleIcon className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
};