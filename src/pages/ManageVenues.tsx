import VenueManagement from "@/components/dashboard/admin/VenueManagement";
import PageLayout from "@/components/PageLayout";

const ManageVenues = () => {
  return (
    <PageLayout title="Manage Venues" subtitle="Create, edit, and manage all venues">
      <VenueManagement />
    </PageLayout>
  );
};

export default ManageVenues;
