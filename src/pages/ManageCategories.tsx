import HookahCategoryManagement from "@/components/dashboard/admin/HookahCategoryManagement";
import PageLayout from "@/components/PageLayout";

const ManageCategories = () => {
  return (
    <PageLayout title="Manage Hookah Categories" subtitle="Create and manage hookah categories for all venues">
      <HookahCategoryManagement />
    </PageLayout>
  );
};

export default ManageCategories;
