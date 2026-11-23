import { EducationServicePage } from "@/components/education-service-page";
import { educationServices } from "@/lib/education-services";
import { pageMetadata } from "@/lib/seo";

const service = educationServices.training;
export const generateMetadata = () => pageMetadata(service);

export default function TeacherTrainingPage() {
  return <EducationServicePage service={service} />;
}
