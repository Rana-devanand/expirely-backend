export interface ErrorResponse {
  success: boolean;
  error_code: number;
  message: string;
  data: any;
}

export const createResponse = (data: any, message: string = "Success") => {
  return {
    success: true,
    message,
    data,
  };
};
