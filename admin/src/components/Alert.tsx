import { Icons } from "../Icons";

type AlertProps = {
  type: "error" | "success";
  message: string;
};

export function Alert({ type, message }: AlertProps) {
  return (
    <div className={`alert alert-${type}`}>
      <span className="alert-icon">
        {type === "error" ? <Icons.AlertCircle /> : <Icons.Check />}
      </span>
      <span>{message}</span>
    </div>
  );
}
