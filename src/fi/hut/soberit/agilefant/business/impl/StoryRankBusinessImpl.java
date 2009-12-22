package fi.hut.soberit.agilefant.business.impl;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import fi.hut.soberit.agilefant.business.StoryRankBusiness;
import fi.hut.soberit.agilefant.db.StoryRankDAO;
import fi.hut.soberit.agilefant.model.Backlog;
import fi.hut.soberit.agilefant.model.Story;
import fi.hut.soberit.agilefant.model.StoryRank;

@Service("storyRankBusiness")
@Transactional
public class StoryRankBusinessImpl implements StoryRankBusiness {

    @Autowired
    private StoryRankDAO storyRankDAO;

    /**
     * {@inheritDoc}
     */
    public void rankAbove(Story story, Backlog context, Story upper) {
        StoryRank rank = this.storyRankDAO.retrieveByBacklogAndStory(context,
                story);
        StoryRank nextRank = this.storyRankDAO.retrieveByBacklogAndStory(
                context, upper);
        if (rank == null) {
            rank = createRank(story, context);
        }
        if (nextRank != null) {
            rankAbove(rank, nextRank);
        }
    }

    /**
     * Create a rank for a story in the given context.
     */
    private StoryRank createRank(Story story, Backlog context) {
        StoryRank rank;
        rank = new StoryRank();
        rank.setStory(story);
        rank.setBacklog(context);
        int id = (Integer) this.storyRankDAO.create(rank);
        rank = this.storyRankDAO.get(id);
        return rank;
    }

    private void rankAbove(StoryRank rank, StoryRank next) {
        LinkedList<StoryRank> ranks = prepareRankingContext(rank);

        int nextIndex = ranks.indexOf(next);
        if (nextIndex == -1) {
            ranks.addLast(rank);
        } else {
            ranks.add(nextIndex, rank);
        }

        updateContextRanks(ranks);
    }

    private void rankBelow(StoryRank rank, StoryRank previous) {
        LinkedList<StoryRank> ranks = prepareRankingContext(rank);

        int previousIndex = ranks.indexOf(previous);
        if (previousIndex == -1 || previousIndex == ranks.size() - 1) {
            ranks.addLast(rank);
        } else {
            ranks.add(previousIndex + 1, rank);
        }

        updateContextRanks(ranks);
    }

    private void updateContextRanks(LinkedList<StoryRank> ranks) {
        int currentRankNum = 0;
        for (StoryRank currentRank : ranks) {
            currentRank.setRank(currentRankNum++);
        }
    }

    private LinkedList<StoryRank> prepareRankingContext(StoryRank rank) {
        LinkedList<StoryRank> ranks = retrieveLinkedList(rank);
        if (ranks.contains(rank)) {
            ranks.remove(rank);
        }
        return ranks;
    }

    private LinkedList<StoryRank> retrieveLinkedList(StoryRank rank) {
        LinkedList<StoryRank> ranks = new LinkedList<StoryRank>();
        ranks.addAll(this.storyRankDAO
                .retrieveRanksByBacklog(rank.getBacklog()));
        return ranks;
    }

    /**
     * Remove item from the linked list.
     */

    private void skipRank(StoryRank rank) {
        LinkedList<StoryRank> ranks = retrieveLinkedList(rank);
        ranks.remove(rank);
        updateContextRanks(ranks);
    }

    /**
     * {@inheritDoc}
     */
    public void rankBelow(Story story, Backlog context, Story upper) {
        StoryRank rank = this.storyRankDAO.retrieveByBacklogAndStory(context,
                story);
        StoryRank prevRank = this.storyRankDAO.retrieveByBacklogAndStory(
                context, upper);
        if (rank == null) {
            rank = createRank(story, context);
        }
        if (prevRank != null) {
            rankBelow(rank, prevRank);
        }

    }

    /**
     * {@inheritDoc}
     */
    public List<Story> retrieveByRankingContext(Backlog backlog) {
        List<StoryRank> ranks = this.storyRankDAO.retrieveRanksByBacklog(backlog);
        List<Story> stories = new ArrayList<Story>();
        for(StoryRank rank : ranks ) {
            stories.add(rank.getStory());
        }
        return stories;
    }

    /**
     * {@inheritDoc}
     */
    public void removeRank(Story story, Backlog context) {
        StoryRank rank = this.storyRankDAO.retrieveByBacklogAndStory(context,
                story);
        if (rank != null) {
            skipRank(rank);
            this.storyRankDAO.remove(rank);
        }
    }

    /**
     * {@inheritDoc}
     */
    public void removeStoryRanks(Story story) {
        for (StoryRank rank : story.getStoryRanks()) {
            skipRank(rank);
            this.storyRankDAO.remove(rank);
        }

    }

    /**
     * {@inheritDoc}
     */
    public void removeBacklogRanks(Backlog backlog) {
        for (StoryRank rank : backlog.getStoryRanks()) {
            skipRank(rank);
            this.storyRankDAO.remove(rank);
        }
    }

    /**
     * {@inheritDoc}
     */
    public void rankToBottom(Story story, Backlog context) {
        StoryRank rank = this.storyRankDAO.retrieveByBacklogAndStory(context,
                story);
        LinkedList<StoryRank> ranks = new LinkedList<StoryRank>();
        ranks.addAll(this.storyRankDAO.retrieveRanksByBacklog(context));
        StoryRank tailRank = null;
        try {
            tailRank = ranks.getLast();
        } catch (Exception e) {

        }
        if (rank == null) {
            rank = createRank(story, context);
        }
        if (tailRank != null) {
            rankBelow(rank, tailRank);
        }

    }

    public void rankToHead(Story story, Backlog backlog) {
        StoryRank rank = this.storyRankDAO.retrieveByBacklogAndStory(backlog,
                story);
        LinkedList<StoryRank> ranks = new LinkedList<StoryRank>();
        ranks.addAll(this.storyRankDAO.retrieveRanksByBacklog(backlog));
        StoryRank topRank = null;
        try {
            topRank = ranks.getFirst();
        } catch (Exception e) {

        }
        if (rank == null) {
            rank = createRank(story, backlog);
        }
        if (topRank != null) {
            rankAbove(rank, topRank);
        }
    }

    public void setStoryRankDAO(StoryRankDAO storyRankDAO) {
        this.storyRankDAO = storyRankDAO;
    }
}
