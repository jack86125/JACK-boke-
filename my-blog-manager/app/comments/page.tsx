import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import CommentsBoard from './CommentsBoard';

export const metadata = {
  title: "评论管理 | XingHuiSama の 博客",
  description: "管理访客在博客上留下的评论",
};

export default function CommentsPage() {
  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <div className="mt-28">
          <CommentsBoard />
        </div>
      </PageTransition>
    </div>
  );
}
