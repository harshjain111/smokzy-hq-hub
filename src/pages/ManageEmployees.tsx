import EmployeeManagement from "@/components/dashboard/admin/EmployeeManagement";
import PageLayout from "@/components/PageLayout";

const ManageEmployees = () => {
  return (
    <PageLayout title="Manage Employees" subtitle="Create, edit, and manage all employees">
      <EmployeeManagement />
    </PageLayout>
  );
};

export default ManageEmployees;
